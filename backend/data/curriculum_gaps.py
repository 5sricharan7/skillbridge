"""The Stage 8C curriculum gap engine.

Compares one normalized curriculum record against one role's Stage 7 industry
intelligence and returns an explainable gap dataset: for every skill, what the
industry recorded, whether the curriculum already covers it, which courses do the
covering, and what evidence is missing.

Design constraints, all deliberate:

* **Reuse, do not recompute.** The industry side comes from
  :func:`curriculum_intelligence.build_role_curriculum_intelligence`, the exact
  function behind ``GET /curriculum-intelligence/{role}``, and the curriculum side
  comes from :func:`curriculum_record.load_curriculum_gap_inputs`, which shares
  one join implementation with ``GET /curriculum-coverage/{role}``. Nothing here
  re-reads an artifact or re-derives a Stage 7 field.
* **The join key is the normalized skill name.** See
  :func:`curriculum_record.build_curriculum_skill_index`. Exact match only.
* **Preserve Stage 7 exactly.** ``classification``, ``frequency``,
  ``velocity_score``, ``time_slices_used``, ``slices``, ``absolute_change``,
  ``percentage_change``, ``hours``, ``hours_source`` and ``prerequisites`` are
  copied verbatim into ``industry_evidence``, including ``null``. A missing
  measurement stays ``null`` and is named in ``evidence_limitations``; it is never
  filled in, defaulted, or rounded here.
* **No invented analytics.** No score, weight, composite, rank, growth percentage
  or threshold is computed. Ordering is inherited from the order Stage 7 publishes
  ``skills`` in, so this stage cannot introduce a ranking of its own. The two
  groups that are not Stage 7 rows are ordered alphabetically by skill name.
* **No gap arithmetic.** Counts are reported as counts. No percentage of the
  curriculum is covered.
* **Insufficient-data states are preserved.** A skill whose industry row carries
  ``frequency: null`` or no velocity slices is reported with that state intact.
* **A curriculum skill Stage 7 never recorded is not a gap.** It appears under
  ``no_industry_record`` with ``is_gap: false`` and ``coverage_status:
  "no_industry_record"``, and never under ``gaps`` or ``covered_skills``. There is
  no industry evidence for it, so it cannot be classified either way.
* **Unmatched curriculum skills stay visible** under
  ``unmatched_curriculum_skill`` with ``is_gap: false``.
* **``/velocity/{skill}`` is never used.** Growth comes only from the ``skills``
  rows Stage 7 already published for the role.
* **8D boundary.** Semester placement and any recommendation stay out of this
  stage. ``semester_placement`` is reported as unavailable and the covering
  courses' ``academic_year_id`` / ``semester_id`` are carried through unchanged as
  recorded facts, not as advice.
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Optional

from .curriculum_record import load_curriculum_gap_inputs

__all__ = [
    "COVERAGE_STATUS_COVERED",
    "COVERAGE_STATUS_GAP",
    "COVERAGE_STATUS_NO_INDUSTRY_RECORD",
    "COVERAGE_STATUS_UNMATCHED",
    "CURRICULUM_GAPS_NOT_AVAILABLE",
    "COVERAGE_BASIS",
    "build_role_curriculum_gaps",
]

# The join key, stated in the response so a consumer never has to guess it.
COVERAGE_BASIS = "normalized_skill_exact_match"

COVERAGE_STATUS_COVERED = "covered"
COVERAGE_STATUS_GAP = "not_covered"
COVERAGE_STATUS_NO_INDUSTRY_RECORD = "no_industry_record"
COVERAGE_STATUS_UNMATCHED = "unmatched_curriculum_skill"

# Stage 7's own not-available field names, carried through unchanged, plus the
# Stage 8C-specific gaps. No entry here is a claim the data supports.
CURRICULUM_GAPS_NOT_AVAILABLE: tuple[str, ...] = (
    "university",
    "programme",
    "academic_year",
    "semester",
    "course",
    "credit",
    "curriculum_revision",
    "curriculum_change_over_time",
    "industry_growth_percentage",
    "coverage_percentage",
    "prerequisite_evidence",
    "gap_score",
    "gap_priority",
    "gap_rank",
    "semester_placement",
    "course_recommendation",
    "curriculum_revision_recommendation",
)

# The Stage 7 row, copied verbatim into every industry record. Listed here so the
# preservation contract is asserted by a test rather than only by this comment.
INDUSTRY_EVIDENCE_FIELDS: tuple[str, ...] = (
    "skill",
    "frequency",
    "classification",
    "velocity_score",
    "time_slices_used",
    "slices",
    "absolute_change",
    "percentage_change",
    "hours",
    "hours_source",
    "prerequisites",
)

_VELOCITY_FIELDS = (
    "velocity_score",
    "time_slices_used",
    "slices",
    "absolute_change",
    "percentage_change",
)


def _limitation(code: str, note: str) -> dict[str, str]:
    return {"code": code, "note": note}


def _industry_limitations(
    row: Mapping[str, Any], *, role_plannable: bool
) -> list[dict[str, str]]:
    """Name what this skill's industry row does not record.

    Every entry is derived from an actual ``null`` or an actual absent block, so
    this explains recorded state and never speculates about it.
    """
    limitations: list[dict[str, str]] = []

    if row["frequency"] is None:
        limitations.append(
            _limitation(
                "industry_frequency_not_recorded",
                "Stage 7 recorded no frequency for this skill, so no demand "
                "evidence is available for it.",
            )
        )

    recorded_velocity = [field for field in _VELOCITY_FIELDS if row[field] is not None]
    if not recorded_velocity:
        limitations.append(
            _limitation(
                "industry_velocity_not_recorded",
                "Stage 7 recorded no velocity or change measurement for this "
                "skill, so no direction or growth evidence is available for it.",
            )
        )
    elif len(recorded_velocity) != len(_VELOCITY_FIELDS):
        missing = [field for field in _VELOCITY_FIELDS if row[field] is None]
        limitations.append(
            _limitation(
                "industry_velocity_partially_recorded",
                "Stage 7 left these velocity fields null: "
                + ", ".join(missing)
                + ".",
            )
        )

    if row["hours"] is None:
        limitations.append(
            _limitation(
                "learning_hours_not_recorded",
                "No learning hours are recorded for this skill, so the effort a "
                "gap would cost is unknown rather than zero.",
            )
        )
    elif row["hours_source"] is None:
        limitations.append(
            _limitation(
                "learning_hours_source_not_recorded",
                "Learning hours are recorded without a source, so their origin "
                "cannot be cited.",
            )
        )

    if row["prerequisites"] is None:
        limitations.append(
            _limitation(
                "prerequisites_not_recorded",
                "No industry prerequisites are recorded for this skill.",
            )
        )

    if not role_plannable:
        limitations.append(
            _limitation(
                "corpus_only_role",
                "Stage 7 records this role as corpus-only, so no role band is "
                "available for this skill.",
            )
        )

    return limitations


def _curriculum_limitations(courses: list[Mapping[str, Any]]) -> list[dict[str, str]]:
    limitations: list[dict[str, str]] = []

    if len({course["course_id"] for course in courses}) > 1:
        limitations.append(
            _limitation(
                "duplicate_course_coverage",
                "This skill is recorded in "
                + str(len({course["course_id"] for course in courses}))
                + " courses; the curriculum teaches it more than once.",
            )
        )

    return limitations


def _demo_limitation(is_demo: bool) -> list[dict[str, str]]:
    """The demo flag rides on every record, not only the ones with courses.

    The curriculum record is one document, so a gap is just as demo-derived as a
    covered skill, and a consumer must not have to check a different field to
    learn that.
    """
    if not is_demo:
        return []
    return [
        _limitation(
            "curriculum_record_is_demo",
            "The curriculum record compared here is labelled demo data, not a "
            "real programme.",
        )
    ]


def _uncovered_limitation() -> dict[str, str]:
    return _limitation(
        "no_curriculum_course",
        "No course in this curriculum records this skill, so nothing in the "
        "curriculum addresses it.",
    )


def _industry_record(
    row: Mapping[str, Any],
    *,
    courses: list[Mapping[str, Any]],
    role_plannable: bool,
    is_demo: bool,
) -> dict[str, Any]:
    """One explainable gap record for a skill Stage 7 recorded."""
    limitations = _industry_limitations(row, role_plannable=role_plannable)
    limitations.extend(
        _curriculum_limitations(courses) if courses else [_uncovered_limitation()]
    )
    limitations.extend(_demo_limitation(is_demo))

    covered = bool(courses)
    return {
        "skill": row["skill"],
        "coverage_status": COVERAGE_STATUS_COVERED if covered else COVERAGE_STATUS_GAP,
        "is_gap": not covered,
        "classification": row["classification"],
        # The Stage 7 row, verbatim, including every null.
        "industry_evidence": deepcopy(dict(row)),
        "curriculum_courses": [deepcopy(dict(course)) for course in courses],
        "course_count": len({course["course_id"] for course in courses}),
        "learning": {
            "hours": deepcopy(row["hours"]),
            "hours_source": deepcopy(row["hours_source"]),
            "recorded": row["hours"] is not None,
        },
        # The same value as industry_evidence["prerequisites"], surfaced at the
        # top level so a consumer does not have to reach into the evidence block.
        "prerequisites": deepcopy(row["prerequisites"]),
        "evidence_limitations": limitations,
    }


def _no_industry_record(
    skill: str,
    courses: list[Mapping[str, Any]],
    unmatched: list[Mapping[str, Any]],
    *,
    is_demo: bool,
) -> dict[str, Any]:
    """A curriculum skill Stage 7 never recorded.

    This is neither a gap nor coverage. There is no industry row, so there is no
    classification and no demand evidence to report, and both are ``None`` rather
    than a guess.
    """
    limitations = [
        _limitation(
            "no_industry_record",
            "Stage 7 records no industry evidence for this skill, so it is "
            "neither a gap nor counted as covered.",
        )
    ]
    limitations.extend(_curriculum_limitations(courses))
    limitations.extend(_demo_limitation(is_demo))
    if unmatched:
        limitations.append(
            _limitation(
                "recorded_but_unmatched",
                "At least one course records this skill as an unmatched name, so "
                "the recorded spelling is not in the shared vocabulary.",
            )
        )

    return {
        "skill": skill,
        "coverage_status": COVERAGE_STATUS_NO_INDUSTRY_RECORD,
        "is_gap": False,
        "classification": None,
        "industry_evidence": None,
        "curriculum_courses": [deepcopy(dict(course)) for course in courses],
        "course_count": len({course["course_id"] for course in courses}),
        "learning": {"hours": None, "hours_source": None, "recorded": False},
        "prerequisites": None,
        "evidence_limitations": limitations,
    }


def _unmatched_curriculum_skill(entry: Mapping[str, Any]) -> dict[str, Any]:
    """A recorded skill name that is not in the shared vocabulary.

    Kept visible rather than dropped or resolved to the nearest name: a spelling
    that does not join cannot be claimed to cover anything.
    """
    limitations = [
        _limitation(
            "unmatched_curriculum_skill",
            "This recorded skill name is not in the shared vocabulary, so it "
            "cannot be joined to industry evidence.",
        ),
        _limitation(
            "no_curriculum_course",
            "Because the name does not join, no course counts as covering any "
            "industry skill through this entry.",
        ),
    ]

    return {
        "skill": entry["skill"],
        "input_skill": entry["input_skill"],
        "coverage_status": COVERAGE_STATUS_UNMATCHED,
        "is_gap": False,
        "classification": None,
        "industry_evidence": None,
        "curriculum_courses": [],
        "course_count": 0,
        "learning": {"hours": None, "hours_source": None, "recorded": False},
        "prerequisites": None,
        "evidence_limitations": limitations,
    }


def build_role_curriculum_gaps(
    role: str,
    *,
    directory: Optional[Path] = None,
    curriculum_directory: Optional[Path] = None,
) -> dict[str, Any]:
    """Compare one curriculum record against one role's Stage 7 intelligence.

    covered is an industry skill mapped to at least one curriculum course;
    not_covered is an industry skill mapped to none of them; a curriculum skill
    Stage 7 never recorded is reported separately and is never counted as a gap
    or as coverage.

    Raises :class:`adapters.UnknownTargetRoleError` for a role the artifacts do
    not record, and :class:`adapters.UnplannableTargetRoleError` is never raised:
    a corpus-only role is a real recorded state, answered like Stage 7 answers it.
    """
    inputs = load_curriculum_gap_inputs(
        role, directory=directory, curriculum_directory=curriculum_directory
    )
    record = inputs["record"]
    industry = inputs["industry"]
    by_skill = inputs["index"]["by_skill"]
    industry_names = inputs["industry_names"]
    is_demo = bool(record["is_demo"])
    role_plannable = bool(industry["plannable"])

    covered: list[dict[str, Any]] = []
    gaps: list[dict[str, Any]] = []
    # Iterating industry["skills"] inherits Stage 7's published order exactly.
    for row in industry["skills"]:
        courses = by_skill.get(str(row["skill"]), [])
        entry = _industry_record(
            row, courses=courses, role_plannable=role_plannable, is_demo=is_demo
        )
        (covered if entry["coverage_status"] == COVERAGE_STATUS_COVERED else gaps).append(
            entry
        )

    unmatched_by_skill: dict[str, list[Mapping[str, Any]]] = {}
    for entry in record["validation"]["unmatched_skills"]:
        unmatched_by_skill.setdefault(str(entry["skill"]), []).append(entry)

    no_industry_record = [
        _no_industry_record(
            skill,
            by_skill[skill],
            unmatched_by_skill.get(skill, []),
            is_demo=is_demo,
        )
        for skill in sorted(set(by_skill) - industry_names)
    ]

    unmatched_curriculum_skills = [
        _unmatched_curriculum_skill(entry)
        for entry in sorted(
            record["validation"]["unmatched_skills"],
            key=lambda item: (str(item["skill"]), str(item["input_skill"])),
        )
    ]

    return {
        "role_category": industry["role_category"],
        "record_id": record["record_id"],
        "is_demo": is_demo,
        "disclaimer": record["disclaimer"],
        "coverage_basis": COVERAGE_BASIS,
        "industry": {
            "plannable": role_plannable,
            "corpus": deepcopy(industry["corpus"]),
            "velocity_slices": deepcopy(industry["velocity_slices"]),
            "velocity_reproducibility": deepcopy(industry["velocity_reproducibility"]),
            "evidence": deepcopy(industry["evidence"]),
            "skill_count": len(industry["skills"]),
        },
        "gaps": gaps,
        "covered_skills": covered,
        "no_industry_record": no_industry_record,
        "unmatched_curriculum_skills": unmatched_curriculum_skills,
        "summary": {
            "industry_skill_count": len(industry["skills"]),
            "covered_count": len(covered),
            "gap_count": len(gaps),
            "no_industry_record_count": len(no_industry_record),
            "unmatched_curriculum_skill_count": len(unmatched_curriculum_skills),
        },
        # Carried through unchanged so a consumer can see recorded prerequisite
        # cycles. Acting on them is Stage 8D, not this stage.
        "validation": deepcopy(record["validation"]),
        "not_available": list(CURRICULUM_GAPS_NOT_AVAILABLE),
        "stage_boundary": {
            "semester_placement": "stage_8d",
            "course_recommendation": "stage_8d",
        },
    }
