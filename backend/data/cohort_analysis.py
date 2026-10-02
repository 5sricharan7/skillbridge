"""Stage 13 — aggregate one submitted cohort against the recorded market baseline.

Two independent inputs meet here and are never merged:

* **The cohort** is whatever the caller submitted: a list of student
  identifiers and the skills each record names. Nothing is inferred about a
  student beyond that list. No student record is stored, kept or joined to a
  previous request — the cohort exists only for the length of one request.
* **The market baseline** is the finalized prepared artifact set, read through
  :func:`curriculum_intelligence.build_role_curriculum_intelligence`, the exact
  builder behind ``GET /curriculum-intelligence/{role}`` and the prepared half of
  ``GET /market-demand``. Reading it the same way is what makes it impossible for
  this comparison to drift from a baseline a client already reads.

Design constraints, all deliberate:

* **Coverage, not proficiency.** ``student_proficiency`` is the share of the
  submitted cohort whose record names the skill. This repository holds no
  assessment, grading or proficiency record, and none is estimated: a skill no
  student records scores zero coverage, which is a recorded absence rather than a
  measurement of a student who lacks it.
* **The gap is a subtraction, not a score.** ``gap`` is
  ``market_demand - student_proficiency``. Positive means the baseline names the
  skill more often than this cohort records it. It is ``null`` for a skill the
  baseline does not record for the role, because there is no market figure to
  subtract — never zero, which would assert a market figure that does not exist.
* **The live layer is absent on purpose.** Three live postings cannot carry a
  share of postings naming a skill, so comparing a cohort against them would
  manufacture a figure. The live sample stays out of this module entirely.
* **Normalization is the existing one.** Skills are folded with
  :func:`adapters.normalize_skill` — casefold and whitespace collapse, the same
  key the artifacts and the optimizer already use. Nothing here invents a second
  matching rule, and near-matches are never merged on a guess.
* **Deterministic output.** The same cohort and role always produce the same
  rows in the same order, so two runs can be compared field by field.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Mapping, Optional, Sequence

from .adapters import normalize_skill, validate_target_role
from .curriculum_intelligence import build_role_curriculum_intelligence

#: Figures this analysis cannot support, named rather than approximated. They are
#: refused here for the same reason the market endpoint refuses them: the evidence
#: to compute them is not in the repository.
COHORT_NOT_AVAILABLE: tuple[str, ...] = (
    "assessed_proficiency",
    "cohort_completeness",
    "employability_score",
    "institution_ranking",
    "learner_shortfall_count",
    "live_market_comparison",
    "placement_prediction",
    "student_identifier_meaning",
)

#: Shares are rounded here rather than at full float width so that a stored
#: response compares equal field by field across runs and platforms. Four decimal
#: places is finer than any figure the prepared artifacts carry.
SHARE_PRECISION = 4


class CohortInputError(ValueError):
    """Raised when a submitted cohort cannot be read as a cohort of students.

    Carries the offending record's position so a caller pasting a roster can find
    the row that needs fixing rather than being told the whole roster is wrong.
    """


def _identifier(student: object, index: int) -> str:
    """Read one student identifier, refusing a blank or non-string one."""
    raw = getattr(student, "student_id", None)
    if raw is None and isinstance(student, Mapping):
        raw = student.get("student_id")
    if not isinstance(raw, str):
        raise CohortInputError(f"cohort[{index}].student_id must be a string.")
    identifier = raw.strip()
    if not identifier:
        raise CohortInputError(f"cohort[{index}].student_id is required and cannot be blank.")
    return identifier


def _skills_for(student: object, index: int) -> tuple[list[str], int]:
    """Normalize one student's skills, dropping blanks and repeats.

    Returns the normalized skills in first-seen order and how many submitted
    entries were dropped, so a roster that lists the same skill twice is
    reported rather than silently deduplicated. A repeat inside one student is a
    duplicate record, not a second student holding the skill, so it never
    inflates coverage.
    """
    raw = getattr(student, "skills", None)
    if raw is None and isinstance(student, Mapping):
        raw = student.get("skills")
    if isinstance(raw, (str, bytes)) or not isinstance(raw, Sequence):
        raise CohortInputError(f"cohort[{index}].skills must be a list of skill names.")

    ordered: list[str] = []
    seen: set[str] = set()
    dropped = 0
    for position, entry in enumerate(raw):
        if not isinstance(entry, str):
            raise CohortInputError(f"cohort[{index}].skills[{position}] must be a string.")
        skill = normalize_skill(entry)
        if not skill or skill in seen:
            dropped += 1
            continue
        seen.add(skill)
        ordered.append(skill)
    return ordered, dropped


def _baseline_by_skill(record: Mapping[str, object]) -> dict[str, dict[str, object]]:
    """Index one role's recorded skills by normalized name.

    Keys come from the artifact already normalized, so this matches the cohort
    side exactly. A row without a usable skill name is dropped rather than given
    a placeholder key.
    """
    rows = record.get("skills")
    indexed: dict[str, dict[str, object]] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        skill = row.get("skill")
        if not isinstance(skill, str) or not skill.strip():
            continue
        indexed[normalize_skill(skill)] = row
    return indexed


def _market_demand(row: Mapping[str, object]) -> Optional[float]:
    """The recorded share of this role's postings naming the skill, or ``None``.

    ``frequency`` is copied, not recomputed. A missing or non-numeric frequency
    stays ``None``; it is never read as a zero demand.
    """
    frequency = row.get("frequency")
    if isinstance(frequency, bool) or not isinstance(frequency, (int, float)):
        return None
    return round(float(frequency), SHARE_PRECISION)


def build_cohort_analysis(
    cohort: Sequence[object],
    *,
    target_role: str,
    directory: Optional[Path] = None,
) -> dict[str, object]:
    """Aggregate a submitted cohort and compare it to one role's recorded baseline.

    ``cohort`` is the caller's own records. An empty cohort is refused rather
    than analysed: with no students, ``student_proficiency`` has no denominator,
    and reporting every baseline skill as a full gap would assert a cohort
    shortfall that was never measured.

    ``target_role`` is validated through the same call ``POST /roadmap`` uses, so
    an unknown or unplannable role is rejected here exactly as it is there.

    Rows cover the union of the cohort's skills and the role's recorded skills, so
    a skill nobody in the cohort records is still reported — it is the largest gap
    the comparison can show. Ordering puts baseline-recorded skills first, the
    widest gap first inside them, and skills the baseline does not record last.
    """
    role = validate_target_role(target_role, directory=directory)

    students = list(cohort)
    if not students:
        raise CohortInputError("cohort must contain at least one student record.")

    baseline = build_role_curriculum_intelligence(role, directory=directory)
    baseline_by_skill = _baseline_by_skill(baseline)
    corpus = baseline.get("corpus") if isinstance(baseline.get("corpus"), dict) else {}

    listed: dict[str, list[str]] = defaultdict(list)
    identifiers: set[str] = set()
    submitted = 0
    dropped = 0
    students_with_skills = 0

    for index, student in enumerate(students):
        identifier = _identifier(student, index)
        if identifier in identifiers:
            raise CohortInputError(
                f"cohort[{index}].student_id {identifier!r} is already used by an earlier "
                "record. One student may appear once, so their coverage is counted once."
            )
        identifiers.add(identifier)

        skills, discarded = _skills_for(student, index)
        submitted += len(skills) + discarded
        dropped += discarded
        if skills:
            students_with_skills += 1
        for skill in skills:
            listed[skill].append(identifier)

    cohort_size = len(students)
    rows: list[dict[str, object]] = []

    for skill in set(baseline_by_skill) | set(listed):
        holders = sorted(listed.get(skill, []))
        proficiency = round(len(holders) / cohort_size, SHARE_PRECISION)
        record = baseline_by_skill.get(skill)

        if record is None:
            rows.append(
                {
                    "skill": skill,
                    "students_listing": len(holders),
                    "cohort_size": cohort_size,
                    "student_proficiency": proficiency,
                    "market_demand": None,
                    "gap": None,
                    "in_market_baseline": False,
                    "market_classification": None,
                    "students": holders,
                }
            )
            continue

        demand = _market_demand(record)
        rows.append(
            {
                "skill": skill,
                "students_listing": len(holders),
                "cohort_size": cohort_size,
                "student_proficiency": proficiency,
                "market_demand": demand,
                "gap": None if demand is None else round(demand - proficiency, SHARE_PRECISION),
                "in_market_baseline": True,
                "market_classification": record.get("classification"),
                "students": holders,
            }
        )

    # Two stable passes: alphabetical first, then gap. Python's sort is stable, so
    # the alphabetical order survives as the tiebreak inside equal gaps, and rows
    # with no gap (the baseline does not record the skill) land last.
    rows.sort(key=lambda row: (row["in_market_baseline"] is not True, str(row["skill"])))
    rows.sort(key=lambda row: (row["gap"] is None, -(row["gap"] or 0.0)))

    return {
        "cohort_size": cohort_size,
        "students_with_skills": students_with_skills,
        "skill_records_submitted": submitted,
        "skill_records_deduplicated": dropped,
        "distinct_cohort_skills": len(listed),
        "target_role": role,
        "market_baseline": {
            "role": role,
            "plannable": baseline.get("plannable"),
            "layer": "prepared static baseline",
            "postings": corpus.get("role_postings"),
            "skill_count": len(baseline_by_skill),
            "corpus": {
                "dataset_rows": corpus.get("dataset_rows"),
                "date_min": corpus.get("date_min"),
                "date_max": corpus.get("date_max"),
                "postings_artifact": corpus.get("postings_artifact"),
            },
        },
        "skills": rows,
        "skills_not_in_market_baseline": sorted(skill for skill in listed if skill not in baseline_by_skill),
        "not_available": list(COHORT_NOT_AVAILABLE),
        "method_note": (
            "student_proficiency is the share of this submitted cohort whose record names "
            "the skill, not an assessed level: this repository holds no assessment record "
            "and none is estimated. gap is market_demand minus student_proficiency, so a "
            "positive gap is a skill the recorded baseline names more often than this "
            "cohort does. market_demand is the prepared static baseline, copied from the "
            "artifacts and never merged with the live sample. The cohort is the submitted "
            "list of records and nothing is inferred about any student beyond it."
        ),
    }