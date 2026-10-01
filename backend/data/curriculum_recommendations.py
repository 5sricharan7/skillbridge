"""The Stage 8D semester-aware recommendation engine.

Turns the Stage 8C curriculum gaps into explainable recommendations that name an
**existing** semester and course as context, or say plainly that no placement can
be justified from what the record actually records.

Inputs, all reused rather than re-derived:

* :func:`curriculum_gaps.build_role_curriculum_gaps`, the exact function behind
  ``GET /curriculum-gaps/{role}``. This stage does not decide what a gap is; it
  reads ``is_gap: true`` rows from that response, so a recommendation set can
  never disagree with the gap dataset.
* :func:`curriculum_record.load_curriculum_gap_inputs`, for the whole curriculum
  structure. The gap response deliberately publishes only the courses that cover
  a skill plus ``academic_year_id`` / ``semester_id`` as recorded facts; placing a
  gap needs every course's recorded prerequisite list and the record's own
  ordering, which no gap response carries. Both loaders are therefore called, and
  neither one's work is repeated here.
* Stage 7 industry intelligence, reached only through the two functions above.

Design constraints, all deliberate:

* **Only real industry gaps are recommended.** A recommendation is a row where
  ``is_gap`` is true. A curriculum skill Stage 7 never recorded
  (``no_industry_record``) has no industry evidence at all, so it can be neither a
  gap nor a recommendation, and a recorded skill name that does not join the
  vocabulary (``unmatched_curriculum_skill``) cannot be joined to industry
  evidence either. Both stay listed under ``excluded`` with the reason, and a
  covered skill is excluded for the opposite reason: something already teaches it.
* **Placement basis: recorded prerequisite alignment.** A gap is placed only where
  the record supplies the whole chain: Stage 7 records the skill's prerequisites,
  every one of them is taught by a recorded curriculum course on the same exact
  normalized name, and some recorded course lists one of those courses among its
  own recorded prerequisites. The earliest such course in the record's own order
  is named. That is a real recorded edge between real recorded courses, so the
  placement is a placement; anything weaker would be a guess.
* **"Earliest" is a structural position, not a priority.** The same document
  always yields the same semester, and the earliest valid position is simply the
  first one the recorded sequencing allows. It says nothing about which gap matters
  more, and no gap is ordered against another.
* **Missing, dangling, and cyclic prerequisites block or abstain; they are never
  repaired.** A null or empty prerequisite list means the record provides no chain,
  so the placement is ``insufficient_data``. A prerequisite naming a course the
  record does not define is reported as dangling and excludes that course from
  use as a target. A course on a recorded prerequisite cycle is excluded too,
  because the record contradicts itself about when it may be taken. When exclusion
  leaves no usable target the placement is ``blocked`` and names the cause. No edge
  is added, removed, or rewritten to make a placement succeed, and no prerequisite
  is invented for a skill that records none.
* **A placement never fabricates a semester or course.** ``target_semester`` and
  ``target_course`` are pointers into the echoed ``curriculum.structure`` or they
  are ``null``. Every field on them is a recorded field, including ``null``
  credits and hours.
* **An unplaceable gap stays in the output.** A gap that cannot be placed is still
  reported, with ``placement_status`` saying exactly which recorded fact is
  missing or contradictory. Dropping it would hide the gap.
* **Hours are copied, never estimated.** ``learning_hours`` and ``hours_source``
  are the Stage 7 values verbatim, including ``null``. The record does not schedule
  them into any course, so the recommendation never claims they fit.
* **No invented analytics.** No score, weight, rank, priority, growth percentage,
  threshold, or confidence value exists here. Stage 7's ordering is inherited, not
  re-derived, and ``recommendations`` is that order filtered to the gaps.
* **Evidence limitations are preserved, not summarised away.** Every 8C limitation
  is carried through unchanged and the placement's own limitations are appended.
  The curriculum record's demo label and disclaimer ride on the response and on
  every recommendation, exactly as they do in 8C.
* **Nothing else is read.** ``/velocity/{skill}`` is never called, Stage 7
  endpoints are untouched, and no engine, optimizer, or scorer is imported.

What this stage deliberately does not do: it proposes no curriculum revision, no
new course, and no new semester. A recommendation names where the recorded evidence
already points inside the existing structure; whether to act on it is a curriculum
decision no artifact in this repository records.
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Optional

from .adapters import normalize_skill
from .curriculum_gaps import build_role_curriculum_gaps
from .curriculum_record import load_curriculum_gap_inputs

__all__ = [
    "ORDERING_BASIS",
    "PLACEMENT_BASIS",
    "PLACEMENT_RULES",
    "PREREQUISITE_BASIS",
    "PREREQUISITE_BASIS_JOIN",
    "PLACEMENT_STATUS_BLOCKED_CYCLE",
    "PLACEMENT_STATUS_BLOCKED_DANGLING",
    "PLACEMENT_STATUS_INSUFFICIENT_DATA",
    "PLACEMENT_STATUS_PLACED",
    "PREREQUISITE_STATUS_CYCLE",
    "PREREQUISITE_STATUS_DANGLING",
    "PREREQUISITE_STATUS_EMPTY",
    "PREREQUISITE_STATUS_NOT_RECORDED",
    "PREREQUISITE_STATUS_RESOLVED",
    "PREREQUISITE_STATUS_SKILL_ABSENT",
    "RECOMMENDATION_STATUS_PLACED",
    "RECOMMENDATION_STATUS_UNPLACED",
    "RECOMMENDATIONS_NOT_AVAILABLE",
    "TARGET_SELECTION_BASIS",
    "build_role_curriculum_recommendations",
]


# The one rule that can name a semester, stated in the response so a consumer never
# has to infer it.
PLACEMENT_BASIS = "recorded_prerequisite_course_alignment"

# Prerequisites are read, never composed.
PREREQUISITE_BASIS = "recorded_prerequisite_edges_only"
# The join between a recorded prerequisite skill name and a curriculum course is
# the same exact normalized name Stage 8C uses for coverage. No alias, no fuzzy
# match, no nearest name.
PREREQUISITE_BASIS_JOIN = "normalized_skill_exact_match"

# Recorded order, which is the only ordering this stage uses.
ORDERING_BASIS = (
    "recorded_curriculum_order: programme_id, version_id, academic_year_id, "
    "recorded semester sequence then semester_id, then course_id"
)

# How two structurally valid candidates are separated. Structural, not a priority.
TARGET_SELECTION_BASIS = "earliest_recorded_semester_then_lowest_course_id"

PLACEMENT_STATUS_PLACED = "placed_in_recorded_semester"
PLACEMENT_STATUS_INSUFFICIENT_DATA = "insufficient_data"
PLACEMENT_STATUS_BLOCKED_DANGLING = "blocked_recorded_dangling_prerequisite"
PLACEMENT_STATUS_BLOCKED_CYCLE = "blocked_recorded_prerequisite_cycle"

# Both statuses recommend the gap. The second one says only that no semester can be
# named from the record, which is never a reason to drop the gap.
RECOMMENDATION_STATUS_PLACED = "recommended_with_recorded_placement"
RECOMMENDATION_STATUS_UNPLACED = "recommended_placement_unresolved"

PREREQUISITE_STATUS_RESOLVED = "recorded_and_resolved_in_curriculum"
PREREQUISITE_STATUS_NOT_RECORDED = "prerequisites_not_recorded"
PREREQUISITE_STATUS_EMPTY = "recorded_as_no_prerequisites"
PREREQUISITE_STATUS_SKILL_ABSENT = "prerequisite_skill_absent_from_curriculum"
PREREQUISITE_STATUS_DANGLING = "recorded_dangling_in_curriculum_chain"
PREREQUISITE_STATUS_CYCLE = "recorded_cycle_in_curriculum_chain"

# Blocked statuses, most specific first. A course can fail for both reasons at once;
# the dangling reference wins because it is the harder fact.
_PLACEMENT_STATUSES = (
    PLACEMENT_STATUS_PLACED,
    PLACEMENT_STATUS_BLOCKED_DANGLING,
    PLACEMENT_STATUS_BLOCKED_CYCLE,
    PLACEMENT_STATUS_INSUFFICIENT_DATA,
)

_PREREQUISITE_STATUSES = (
    PREREQUISITE_STATUS_RESOLVED,
    PREREQUISITE_STATUS_NOT_RECORDED,
    PREREQUISITE_STATUS_EMPTY,
    PREREQUISITE_STATUS_SKILL_ABSENT,
    PREREQUISITE_STATUS_DANGLING,
    PREREQUISITE_STATUS_CYCLE,
)

# Stage 8C's not-available list, less the two fields this stage now serves, plus the
# fields this stage still cannot serve. Listed so a consumer can see that the absence
# is declared rather than merely missing.
RECOMMENDATIONS_NOT_AVAILABLE: tuple[str, ...] = (
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
    "curriculum_revision_recommendation",
    "new_course",
    "new_semester",
    "credit_budget",
    "semester_capacity",
    "curriculum_capacity",
    "learning_hours_scheduled",
    "recommendation_score",
    "recommendation_priority",
    "recommendation_rank",
    "placement_confidence",
)

# The rules, in the order they are applied, published so a consumer can follow the
# decision without reading the implementation. Each is a recorded-fact statement.
PLACEMENT_RULES: tuple[str, ...] = (
    "1. Only a skill Stage 8C recorded with is_gap true is recommended; a covered "
    "skill, a skill with no industry record, and a recorded skill name that does "
    "not join the vocabulary are never recommended.",
    "2. Placement uses recorded prerequisites only. A prerequisite is never added, "
    "removed, or inferred from a course title.",
    "3. A prerequisite skill is located in the curriculum on an exact normalized "
    "name match against the courses that record it.",
    "4. A gap is placed in an existing course only when that course records, as one "
    "of its own prerequisites, a course that teaches every recorded prerequisite of "
    "the gap.",
    "5. Among courses that satisfy rule 4, the earliest in the record's own order "
    "wins: recorded semester order first, then the lowest course_id. This is a "
    "structural position, not a ranking, and no gap is compared with another.",
    "6. A prerequisite recorded as null or as an empty list provides no chain, so "
    "placement_status is insufficient_data and the gap is still reported.",
    "7. A prerequisite skill that no recorded course teaches leaves the chain "
    "unresolved, so placement_status is insufficient_data.",
    "8. A course whose recorded prerequisite names a course the record does not "
    "define is reported as dangling and is not used as a placement target or as an "
    "anchor. If that leaves no usable target the placement is blocked.",
    "9. A course that appears on a recorded prerequisite cycle is not used as a "
    "placement target or as an anchor, because the record contradicts itself about "
    "when it may be taken. If that leaves no usable target the placement is "
    "blocked. Cycles elsewhere in the record are reported under validation and do "
    "not block a placement that does not depend on them.",
    "10. No cycle, dangling edge, or missing prerequisite is repaired. Nothing is "
    "reordered, and target_semester and target_course are null unless they point at "
    "a semester and course the record already contains.",
    "11. learning_hours and hours_source are the Stage 7 values verbatim, including "
    "null, and no hours are scheduled into any course.",
    "12. Nothing is scored, weighted, ranked, prioritised, or expressed as a "
    "percentage, and Stage 7's published order is inherited rather than re-derived.",
)


# --------------------------------------------------------------------- helpers


def _limitation(code: str, note: str) -> dict[str, str]:
    return {"code": code, "note": note}


def _names(course_ids: Any) -> str:
    return ", ".join(str(course_id) for course_id in course_ids)


def _quoted(values: Any) -> str:
    return ", ".join(f"{value!r}" for value in values)


# -------------------------------------------------------- recorded structure


def _recorded_structure(
    record: Mapping[str, Any]
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Return every recorded semester in recorded order, plus a course index.

    This is an echo of what the record already says, traversed in the order the
    Stage 8A validator sorted it, so ``recorded_index`` is a position in the record
    and never an opinion about the curriculum. Nothing is filtered, merged, or
    summarised, and a semester with no courses is still reported.
    """
    semesters: list[dict[str, Any]] = []
    courses: dict[str, dict[str, Any]] = {}

    for programme in record["programmes"]:
        for version in programme["curricula"]:
            for year in version["academic_years"]:
                for semester in year["semesters"]:
                    semester_index = len(semesters)
                    course_ids = []
                    for course in semester["courses"]:
                        course_id = str(course["course_id"])
                        course_ids.append(course_id)
                        prerequisites = course["prerequisites"]
                        courses[course_id] = {
                            "course_id": course_id,
                            "name": course["name"],
                            "code": course["code"],
                            "credits": course["credits"],
                            "hours": course["hours"],
                            "is_elective": course["is_elective"],
                            "prerequisites_recorded": bool(prerequisites["recorded"]),
                            "recorded_prerequisites": (
                                list(prerequisites["course_ids"])
                                if prerequisites["recorded"]
                                else None
                            ),
                            "semester_index": semester_index,
                        }
                    semesters.append(
                        {
                            "programme_id": programme["programme_id"],
                            "version_id": version["version_id"],
                            "academic_year_id": year["academic_year_id"],
                            "semester_id": semester["semester_id"],
                            "sequence": semester["sequence"],
                            "term": semester["term"],
                            "label": semester["label"],
                            "recorded_credits": semester["recorded_credits"],
                            "recorded_index": semester_index + 1,
                            "course_count": len(course_ids),
                            "courses": course_ids,
                        }
                    )

    return semesters, courses


def _semester_view(semester: Mapping[str, Any]) -> dict[str, Any]:
    """The fields that identify an existing semester, all as recorded."""
    return {
        "programme_id": semester["programme_id"],
        "version_id": semester["version_id"],
        "academic_year_id": semester["academic_year_id"],
        "semester_id": semester["semester_id"],
        "sequence": semester["sequence"],
        "term": semester["term"],
        "recorded_index": semester["recorded_index"],
    }


def _course_view(
    course: Mapping[str, Any], semester: Mapping[str, Any]
) -> dict[str, Any]:
    """The fields that identify an existing course, all as recorded."""
    return {
        "course_id": course["course_id"],
        "name": course["name"],
        "code": course["code"],
        "credits": course["credits"],
        "hours": course["hours"],
        "is_elective": course["is_elective"],
        "recorded_prerequisites": list(course["recorded_prerequisites"]),
        "semester_id": semester["semester_id"],
        "academic_year_id": semester["academic_year_id"],
        "recorded_index": course["semester_index"] + 1,
    }


def _blockers(record: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    """Map each unusable course to the recorded defects that make it unusable.

    A dangling prerequisite is copied from ``validation`` as recorded and a cycle
    membership from ``cycle_course_ids``. Neither is recomputed here and neither is
    repaired; this only indexes what the record already published.
    """
    blockers: dict[str, dict[str, Any]] = {}
    for entry in record["validation"]["dangling_prerequisites"]:
        blocker = blockers.setdefault(
            str(entry["course_id"]), {"dangling": [], "cycle": False}
        )
        blocker["dangling"].append(str(entry["prerequisite_course_id"]))
    for course_id in record["validation"]["cycle_course_ids"]:
        blockers.setdefault(str(course_id), {"dangling": [], "cycle": False})[
            "cycle"
        ] = True
    for blocker in blockers.values():
        blocker["dangling"].sort()
    return blockers


def _describe_blocker(blocker: Mapping[str, Any]) -> str:
    """Name the recorded defect of one blocked course, as the record published it."""
    if blocker["dangling"]:
        return _names(blocker["dangling"])
    return "another course on the same recorded prerequisite cycle"


# ------------------------------------------------------------------- placement


def _resolve_anchors(
    prerequisites: Any,
    *,
    courses_by_skill: Mapping[str, Any],
    blockers: Mapping[str, Mapping[str, list[str]]],
) -> tuple[Optional[list[dict[str, Any]]], Optional[str], Optional[dict[str, Any]]]:
    """Locate every recorded prerequisite skill in the curriculum.

    Returns the anchors per prerequisite on success, otherwise ``None`` together
    with the status and limitations that explain why no chain exists. A
    prerequisite is never resolved by proximity, only by the exact normalized name.
    """
    limitations: list[dict[str, str]] = []

    if prerequisites is None:
        limitations.append(
            _limitation(
                "no_recorded_prerequisite_chain",
                "Stage 7 records no prerequisites for this skill, so the record "
                "provides no sequence this gap could sit after. No prerequisite was "
                "invented to create one.",
            )
        )
        return None, PLACEMENT_STATUS_INSUFFICIENT_DATA, {
            "status": PREREQUISITE_STATUS_NOT_RECORDED,
            "limitations": limitations,
        }

    if not prerequisites:
        limitations.append(
            _limitation(
                "no_recorded_prerequisite_chain",
                "Stage 7 records this skill as having no prerequisites. Nothing in "
                "the record then says which semester it belongs in, and no semester "
                "was chosen for it on that basis.",
            )
        )
        return None, PLACEMENT_STATUS_INSUFFICIENT_DATA, {
            "status": PREREQUISITE_STATUS_EMPTY,
            "limitations": limitations,
        }

    anchors: list[dict[str, Any]] = []
    absent: list[str] = []
    for prerequisite in prerequisites:
        key = normalize_skill(str(prerequisite))
        recorded_courses = sorted(courses_by_skill.get(key, ()))
        if not recorded_courses:
            absent.append(str(prerequisite))
            continue
        usable = [
            course_id
            for course_id in recorded_courses
            if course_id not in blockers
        ]
        anchors.append(
            {
                "prerequisite": str(prerequisite),
                "join_key": key,
                "recorded_courses": recorded_courses,
                "usable_courses": usable,
                "excluded_courses": [
                    course_id
                    for course_id in recorded_courses
                    if course_id in blockers
                ],
            }
        )

    if absent:
        limitations.append(
            _limitation(
                "prerequisite_skill_absent_from_curriculum",
                "No course in this curriculum records "
                + _quoted(absent)
                + ", which Stage 7 records as a prerequisite of this skill. The "
                "chain is unresolved, so no semester is named and the reference was "
                "not resolved to a similar name.",
            )
        )
        return None, PLACEMENT_STATUS_INSUFFICIENT_DATA, {
            "status": PREREQUISITE_STATUS_SKILL_ABSENT,
            "absent": absent,
            "limitations": limitations,
        }

    blocked = {
        anchor["prerequisite"]: anchor["excluded_courses"]
        for anchor in anchors
        if not anchor["usable_courses"]
    }
    # A prerequisite taught by both a usable course and a blocked one is still
    # resolved by the usable course, so the blocked course is reported in the chain
    # and does not block the placement. Only a prerequisite with no usable teaching
    # course at all has no chain to place against.
    if blocked:
        described = "; ".join(
            f"{prerequisite!r} is taught only by {_names(course_ids)}, whose recorded "
            "prerequisites are not resolvable"
            for prerequisite, course_ids in sorted(blocked.items())
        )
        dangling = any(
            course_id in blockers and blockers[course_id]["dangling"]
            for anchor in anchors
            for course_id in anchor["excluded_courses"]
        )
        limitations.append(
            _limitation(
                "recorded_prerequisite_chain_not_usable",
                f"{described}. The recorded prerequisite is left exactly as "
                "recorded.",
            )
        )
        status = (
            PLACEMENT_STATUS_BLOCKED_DANGLING
            if dangling
            else PLACEMENT_STATUS_BLOCKED_CYCLE
        )
        return None, status, {
            "status": (
                PREREQUISITE_STATUS_DANGLING
                if dangling
                else PREREQUISITE_STATUS_CYCLE
            ),
            "unusable_courses": sorted(
                {
                    course_id
                    for course_ids in blocked.values()
                    for course_id in course_ids
                }
            ),
            "limitations": limitations,
        }

    return anchors, None, None


def _placed_limitations(
    *,
    course: Mapping[str, Any],
    semester: Mapping[str, Any],
    excluded_candidates: list[str],
    inconsistent: list[Mapping[str, Any]],
    hours: Any,
    hours_source: Any,
) -> list[dict[str, str]]:
    """Name everything the placement does not establish.

    Every entry is a statement about a recorded value being absent or a recorded
    observation existing, so none of them is a claim the record cannot support.
    """
    limitations: list[dict[str, str]] = []

    if course["credits"] is None:
        limitations.append(
            _limitation(
                "course_credits_not_recorded",
                f"{course['course_id']} records no credits, so the cost of teaching "
                "this skill there is unknown rather than free.",
            )
        )
    if course["hours"] is None:
        limitations.append(
            _limitation(
                "course_hours_not_recorded",
                f"{course['course_id']} records no contact hours, so nothing in the "
                "record sizes the teaching load of adding this skill to it.",
            )
        )
    if semester["recorded_credits"] is None:
        limitations.append(
            _limitation(
                "semester_credits_not_recorded",
                f"Semester {semester['semester_id']} records no credit total, so the "
                "semester has no recorded capacity to be checked against.",
            )
        )
    if hours is None:
        limitations.append(
            _limitation(
                "learning_hours_not_scheduled",
                "No learning hours are recorded for this skill, and none are "
                "scheduled into any course, because the record does not record how "
                "many hours a course delivers.",
            )
        )
    else:
        limitations.append(
            _limitation(
                "learning_hours_not_scheduled",
                f"Stage 7 records {hours} learning hours for this skill"
                + (f" from {hours_source!r}" if hours_source is not None else "")
                + ", and they are not scheduled into any course, because the record "
                "does not record how many hours a course delivers.",
            )
        )
    limitations.append(
        _limitation(
            "curriculum_revision_not_proposed",
            "No change to the recorded curriculum is proposed or made. "
            f"{course['course_id']} and semester {semester['semester_id']} exist as "
            "recorded and stay as they are.",
        )
    )
    if excluded_candidates:
        limitations.append(
            _limitation(
                "candidate_courses_excluded",
                "Recorded course(s) "
                + _names(sorted(excluded_candidates))
                + " also satisfied the recorded prerequisite chain but were not used "
                "because their own recorded prerequisites are dangling or cyclic. "
                "They were neither repaired nor removed.",
            )
        )
    if inconsistent:
        limitations.append(
            _limitation(
                "recorded_prerequisite_order_inconsistent",
                "The record itself places at least one of these prerequisites in a "
                "later semester than the course that requires it: "
                + "; ".join(
                    f"{entry['course_id']} requires "
                    f"{entry['prerequisite_course_id']}, which is recorded in "
                    f"semester {entry['prerequisite_semester_id']}"
                    for entry in inconsistent
                )
                + ". That contradiction is reported, not corrected, and it may mean "
                "the placement above is not the position the record's author "
                "intended.",
            )
        )

    return limitations


def _order_observations_for(
    course_ids: set[str], inconsistent: list[Mapping[str, Any]]
) -> list[Mapping[str, Any]]:
    return [
        entry
        for entry in inconsistent
        if str(entry["course_id"]) in course_ids
        or str(entry["prerequisite_course_id"]) in course_ids
    ]


def _recommendation(
    gap: Mapping[str, Any],
    *,
    semesters: list[Mapping[str, Any]],
    courses: Mapping[str, Mapping[str, Any]],
    courses_by_skill: Mapping[str, Any],
    blockers: Mapping[str, Mapping[str, list[str]]],
    inconsistent: list[Mapping[str, Any]],
) -> dict[str, Any]:
    """One recommendation for one Stage 8C gap, placed or explicitly not placed.

    The Stage 8C limitations are carried through first and unchanged, so the
    industry's own caveats and the curriculum's demo label survive into the
    recommendation. Placement limitations are appended after them.
    """
    skill = str(gap["skill"])
    prerequisites = gap["prerequisites"]
    industry_evidence = gap["industry_evidence"]
    limitations: list[dict[str, str]] = [
        deepcopy(limitation) for limitation in gap["evidence_limitations"]
    ]

    anchors, refusal, refusal_detail = _resolve_anchors(
        prerequisites,
        courses_by_skill=courses_by_skill,
        blockers=blockers,
    )

    candidate_ids: list[str] = []
    excluded_candidates: list[str] = []
    target_course_id: Optional[str] = None

    if refusal is not None:
        placement_status = refusal
        prerequisite_status = str(refusal_detail["status"])
        limitations.extend(deepcopy(refusal_detail["limitations"]))
        reason = _refusal_reason(
            skill,
            placement_status,
            str(refusal_detail["status"]),
            refusal_detail,
            prerequisites,
        )
    else:
        assert anchors is not None
        # Rule 4: a course qualifies only when it records, as one of its own
        # prerequisites, a course that teaches every recorded prerequisite skill.
        for course_id in sorted(courses):
            course = courses[course_id]
            recorded = course["recorded_prerequisites"]
            if recorded is None:
                continue
            if all(
                any(
                    anchor_course_id in recorded
                    for anchor_course_id in anchor["usable_courses"]
                )
                for anchor in anchors
            ):
                candidate_ids.append(course_id)
        usable_candidates = [
            course_id for course_id in candidate_ids if course_id not in blockers
        ]
        excluded_candidates = [
            course_id for course_id in candidate_ids if course_id in blockers
        ]

        if usable_candidates:
            target_course_id = min(
                usable_candidates,
                key=lambda course_id: (courses[course_id]["semester_index"], course_id),
            )
            placement_status = PLACEMENT_STATUS_PLACED
            prerequisite_status = PREREQUISITE_STATUS_RESOLVED
            reason = ""
        elif candidate_ids:
            # Every recorded candidate is itself unusable. A dangling reference is the
            # harder recorded fact, so it decides both statuses.
            dangling = any(
                blockers[course_id]["dangling"] for course_id in candidate_ids
            )
            placement_status = (
                PLACEMENT_STATUS_BLOCKED_DANGLING
                if dangling
                else PLACEMENT_STATUS_BLOCKED_CYCLE
            )
            prerequisite_status = (
                PREREQUISITE_STATUS_DANGLING
                if dangling
                else PREREQUISITE_STATUS_CYCLE
            )
            described = "; ".join(
                f"{course_id} requires " + _describe_blocker(blockers[course_id])
                for course_id in sorted(candidate_ids)
            )
            limitations.append(
                _limitation(
                    "recorded_prerequisite_chain_not_usable",
                    f"The only recorded course(s) sequenced after the prerequisite "
                    f"chain cannot be used as a target because their own recorded "
                    f"prerequisites are not resolvable: {described}. Nothing was "
                    "repaired, so no semester is named.",
                )
            )
            reason = (
                f"A placement for this skill was blocked. {described}. The recorded "
                "prerequisites were left exactly as recorded."
            )
        else:
            placement_status = PLACEMENT_STATUS_INSUFFICIENT_DATA
            prerequisite_status = PREREQUISITE_STATUS_RESOLVED
            limitations.append(
                _limitation(
                    "no_recorded_course_sequenced_after_prerequisite",
                    "No course in this record lists a course that teaches "
                    + _quoted([anchor["prerequisite"] for anchor in anchors])
                    + " among its own recorded prerequisites, so the record contains "
                    "no position this gap could sit in. No course or semester was "
                    "invented to provide one.",
                )
            )
            reason = (
                "Stage 7 records the prerequisite "
                + _quoted([anchor["prerequisite"] for anchor in anchors])
                + ", and the curriculum teaches it, but no recorded course lists a "
                "course that teaches it as its own prerequisite. The record "
                "therefore contains no placement for this gap."
            )

    target_semester: Optional[dict[str, Any]] = None
    target_course: Optional[dict[str, Any]] = None
    if target_course_id is not None:
        semester = semesters[courses[target_course_id]["semester_index"]]
        course = courses[target_course_id]
        target_semester = _semester_view(semester)
        target_course = _course_view(course, semester)
        reason = _placed_reason(anchors, course, semester)
        limitations.extend(
            _placed_limitations(
                course=course,
                semester=semester,
                excluded_candidates=excluded_candidates,
                inconsistent=_order_observations_for(
                    {target_course_id}
                    | {
                        candidate
                        for anchor in anchors
                        for candidate in anchor["usable_courses"]
                    },
                    inconsistent,
                ),
                hours=industry_evidence["hours"],
                hours_source=industry_evidence["hours_source"],
            )
        )

    return {
        "skill": skill,
        # True for every entry here by construction, and published so a consumer can
        # see this list is exactly the Stage 8C gap set.
        "is_gap": True,
        "coverage_status": gap["coverage_status"],
        "recommendation_status": (
            RECOMMENDATION_STATUS_PLACED
            if placement_status == PLACEMENT_STATUS_PLACED
            else RECOMMENDATION_STATUS_UNPLACED
        ),
        "placement_status": placement_status,
        "target_semester": target_semester,
        "target_course": target_course,
        "reason": reason,
        # The Stage 7 row verbatim, including every null.
        "industry_evidence": deepcopy(industry_evidence),
        # The recorded value itself, including null. Never composed here.
        "prerequisites": deepcopy(prerequisites),
        "prerequisite_status": prerequisite_status,
        "prerequisite_chain": [
            {
                "prerequisite": anchor["prerequisite"],
                "join_key": anchor["join_key"],
                "recorded_courses": list(anchor["recorded_courses"]),
                "usable_courses": list(anchor["usable_courses"]),
                "excluded_courses": list(anchor["excluded_courses"]),
            }
            for anchor in (anchors or [])
        ],
        "learning_hours": deepcopy(industry_evidence["hours"]),
        "hours_source": deepcopy(industry_evidence["hours_source"]),
        "recorded_candidate_courses": sorted(candidate_ids),
        "evidence_limitations": limitations,
    }


def _refusal_reason(
    skill: str,
    placement_status: str,
    prerequisite_status: str,
    detail: Mapping[str, Any],
    prerequisites: Any,
) -> str:
    """One deterministic sentence for every way a gap stays unplaced.

    Each states the recorded fact that stopped the placement and what was not done
    about it, so a reader never has to infer that a semester was withheld on
    purpose rather than forgotten.
    """
    if prerequisite_status == PREREQUISITE_STATUS_NOT_RECORDED:
        return (
            f"No semester can be named for {skill}: Stage 7 records no prerequisites "
            "for it, so the record supplies no sequence to follow. None were "
            "invented."
        )
    if prerequisite_status == PREREQUISITE_STATUS_EMPTY:
        return (
            f"No semester can be named for {skill}: Stage 7 records it as having no "
            "prerequisites, and the record therefore says nothing about where it "
            "belongs. No semester was chosen for it on some other basis."
        )
    if prerequisite_status == PREREQUISITE_STATUS_SKILL_ABSENT:
        return (
            f"No semester can be named for {skill}: Stage 7 records "
            f"{_quoted(list(prerequisites))} as prerequisites, and this curriculum "
            "records no course teaching "
            f"{_quoted(list(detail['absent']))} under that exact name. The chain is "
            "unresolved, and the reference was not resolved to a similar name."
        )
    if prerequisite_status == PREREQUISITE_STATUS_DANGLING:
        return (
            f"No semester can be named for {skill}: the only recorded course(s) that "
            "teach its recorded prerequisites, "
            f"{_names(list(detail['unusable_courses']))}, each record a prerequisite "
            "the curriculum does not define, so the sequence they sit in cannot be "
            "resolved. The dangling reference was reported, not repaired."
        )
    if prerequisite_status == PREREQUISITE_STATUS_CYCLE:
        return (
            f"No semester can be named for {skill}: the only recorded course(s) that "
            "teach its recorded prerequisites, "
            f"{_names(list(detail['unusable_courses']))}, are on a recorded "
            "prerequisite cycle, so the record contradicts itself about when they may "
            "be taken. The cycle was reported, not repaired."
        )
    return (
        f"No semester can be named for {skill} from what the record provides "
        f"({placement_status})."
    )


def _placed_reason(
    anchors: list[Mapping[str, Any]],
    course: Mapping[str, Any],
    semester: Mapping[str, Any],
) -> str:
    """The one deterministic explanation a placed recommendation carries.

    Every clause names a recorded fact: the prerequisite Stage 7 records, the
    courses the record says teach it, and the prerequisite the named course itself
    records. Nothing about the record is paraphrased into a judgement.
    """
    course_id = str(course["course_id"])
    recorded = list(course["recorded_prerequisites"])
    clauses = []
    for anchor in anchors:
        followed = ", ".join(
            candidate
            for candidate in sorted(anchor["usable_courses"])
            if candidate in recorded
        )
        clauses.append(
            f"{anchor['prerequisite']!r} is taught by "
            f"{_names(anchor['recorded_courses'])}; {course_id} records {followed} as "
            "one of its own prerequisites."
        )
    return (
        "Stage 7 records "
        + _quoted([str(anchor["prerequisite"]) for anchor in anchors])
        + " as prerequisites of this skill. "
        + " ".join(clauses)
        + " No course earlier in the record's own order lists a course teaching "
        f"every one of those prerequisites, so {course_id} is the earliest recorded "
        f"position for this gap. It runs in semester {semester['semester_id']} of "
        f"academic year {semester['academic_year_id']}."
    )


# ----------------------------------------------------------------- the response


def _excluded(gaps: Mapping[str, Any]) -> dict[str, Any]:
    """Name every skill that is deliberately not a recommendation, and why.

    Alphabetical within each group, because this list is not Stage 7's published
    order and is not a ranking of anything.
    """
    return {
        "covered_skill": {
            "count": len(gaps["covered_skills"]),
            "skills": sorted(str(record["skill"]) for record in gaps["covered_skills"]),
            "reason": "A course in this curriculum already records this skill, so "
            "there is no gap to recommend.",
        },
        "no_industry_record": {
            "count": len(gaps["no_industry_record"]),
            "skills": sorted(
                str(record["skill"]) for record in gaps["no_industry_record"]
            ),
            "reason": "Stage 7 records no industry evidence for this skill, so it is "
            "neither a gap nor a recommendation.",
        },
        "unmatched_curriculum_skill": {
            "count": len(gaps["unmatched_curriculum_skills"]),
            "skills": sorted(
                str(record["skill"])
                for record in gaps["unmatched_curriculum_skills"]
            ),
            "reason": "This recorded skill name does not join the shared vocabulary, "
            "so it cannot be compared with industry evidence.",
        },
    }


def _counts(recommendations: list[Mapping[str, Any]]) -> dict[str, Any]:
    """Report counts only. No total, share, percentage, or index is derived."""
    placement = {
        status: sum(
            1
            for record in recommendations
            if record["placement_status"] == status
        )
        for status in _PLACEMENT_STATUSES
    }
    prerequisite = {
        status: sum(
            1
            for record in recommendations
            if record["prerequisite_status"] == status
        )
        for status in _PREREQUISITE_STATUSES
    }
    return {
        "recommendation_count": len(recommendations),
        "placed_count": placement[PLACEMENT_STATUS_PLACED],
        "blocked_count": sum(
            count
            for status, count in placement.items()
            if status.startswith("blocked")
        ),
        "insufficient_data_count": placement[PLACEMENT_STATUS_INSUFFICIENT_DATA],
        "by_placement_status": placement,
        "by_prerequisite_status": prerequisite,
    }


def build_role_curriculum_recommendations(
    role: str,
    *,
    directory: Optional[Path] = None,
    curriculum_directory: Optional[Path] = None,
) -> dict[str, Any]:
    """Recommend this role's curriculum gaps inside the recorded semester structure.

    Every Stage 8C gap becomes one recommendation. Where the record supports a
    position, ``target_semester`` and ``target_course`` point at a semester and
    course that already exist; where it does not, they are ``null`` and
    ``placement_status`` says which recorded fact is missing or contradictory.

    Raises :class:`adapters.UnknownTargetRoleError` for a role the artifacts do
    not record, and :class:`adapters.CurriculumRecordError` for a curriculum
    document that does not validate. :class:`adapters.UnplannableTargetRoleError`
    is never raised: a corpus-only role is a real recorded state, answered here the
    way Stage 7 answers it.
    """
    gaps = build_role_curriculum_gaps(
        role, directory=directory, curriculum_directory=curriculum_directory
    )
    inputs = load_curriculum_gap_inputs(
        role, directory=directory, curriculum_directory=curriculum_directory
    )
    record = inputs["record"]

    semesters, courses = _recorded_structure(record)
    blockers = _blockers(record)
    courses_by_skill = inputs["index"]["courses_by_skill"]
    inconsistent = list(record["validation"]["ordering_observations"])

    recommendations = [
        _recommendation(
            gap,
            semesters=semesters,
            courses=courses,
            courses_by_skill=courses_by_skill,
            blockers=blockers,
            inconsistent=inconsistent,
        )
        for gap in gaps["gaps"]
    ]

    return {
        "role_category": gaps["role_category"],
        "record_id": gaps["record_id"],
        "is_demo": gaps["is_demo"],
        "disclaimer": gaps["disclaimer"],
        "coverage_basis": gaps["coverage_basis"],
        "placement_basis": PLACEMENT_BASIS,
        "placement_rules": list(PLACEMENT_RULES),
        "prerequisite_basis": PREREQUISITE_BASIS,
        "prerequisite_join": PREREQUISITE_BASIS_JOIN,
        "ordering_basis": ORDERING_BASIS,
        "target_selection_basis": TARGET_SELECTION_BASIS,
        "industry": deepcopy(gaps["industry"]),
        "curriculum": {
            "record_id": record["record_id"],
            "record_kind": record["record_kind"],
            "semester_count": len(semesters),
            "course_count": len(courses),
            "semesters": deepcopy(semesters),
        },
        "recommendations": recommendations,
        "excluded": _excluded(gaps),
        "summary": {
            "gap_count": gaps["summary"]["gap_count"],
            **_counts(recommendations),
        },
        # The curriculum's own recorded defects, unchanged, so a reader sees the
        # dangling prerequisite, the cycle, and the unmatched name in one place.
        "validation": deepcopy(gaps["validation"]),
        "not_available": list(RECOMMENDATIONS_NOT_AVAILABLE),
        "stage_boundary": {
            "curriculum_revision": "not_proposed",
            "new_course_or_semester": "not_proposed",
            "credit_or_capacity_budget": "not_proposed",
        },
    }