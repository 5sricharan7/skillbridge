"""Stage 8B curriculum record: load, validate, and join one curriculum to Stage 7.

Stage 7A established that this repository holds no university, programme, year,
credit, or course record, so the only curriculum this service can serve is the
hand-authored demonstration record in ``curricula_demo/``. It lives outside
``artifacts/`` on purpose: the artifact loaders assert that directory's contents
exactly, so a curriculum file placed there would be an untracked artifact.

Every value is either recorded or absent. A field nobody recorded is ``null`` and
is named in ``not_recorded`` rather than being filled in, and nothing here scores,
weights, ranks, or infers. Two rules make the record auditable:

* **Union vocabulary, explicit joins.** A curriculum skill joins an industry skill
  only when :func:`adapters.normalize_skill` produces the same string, which is the
  key ``curriculum_intelligence`` already publishes. Resolution runs against the
  union of artifact and catalog skills so an artifact-only skill is not demoted to
  an alias, and token-signature similarity never merges two names.
* **Cycles are reported, not repaired.** A cyclic prerequisite graph is returned
  as it was recorded, with the cycle paths listed under
  ``validation.prerequisite_cycles``. No edge is dropped, no course is reordered,
  and no course is removed, so the record stays readable and the later
  recommendation layer can decide which placements to block.

Nothing here reads the synthetic ``/velocity/{skill}`` fixtures, and
``curriculum_intelligence`` is called rather than reimplemented.
"""

import json
from collections.abc import Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass
from math import isfinite
from pathlib import Path
from typing import Optional

from .adapters import (
    artifact_roles,
    build_skill_vocabulary,
    find_dag_cycles,
    normalize_role,
    normalize_skill,
    resolve_skill_name,
    token_signature_collisions,
)
from .curriculum_intelligence import build_role_curriculum_intelligence


CONTRACT_VERSION = "1"

CURRICULA_DIRECTORY_NAME = "curricula_demo"
CURRICULUM_RECORD_FILE_NAME = "demo_curriculum.json"

RECORD_KINDS: tuple[str, ...] = ("demonstration", "institutional")
VERSION_STATUSES: tuple[str, ...] = ("current", "superseded", "draft")
SEMESTER_TERMS: tuple[str, ...] = ("autumn", "spring", "summer", "winter")
PROVENANCE_KINDS: tuple[str, ...] = (
    "demo",
    "artifact",
    "institution_export",
    "manual_entry",
)
DEMO_PROVENANCE_KINDS: tuple[str, ...] = ("demo", "manual_entry")
MATCH_TYPES: tuple[str, ...] = ("exact", "explicit_alias", "unmatched")

# Fields this contract has no place to record at all, so they are unavailable for
# every record rather than only for the demonstration one. A field that exists in
# the schema and is empty is present-and-unrecorded, which is a different fact and
# must not be listed here.
CURRICULUM_RECORD_NOT_AVAILABLE: tuple[str, ...] = (
    "assessment",
    "course_cohort_enrolment",
    "coverage_percentage",
    "credit_transfer",
    "curriculum_revision_history",
    "enrolment",
    "institution_accreditation",
    "industry_growth_percentage",
    "learning_outcome",
    "programme_accreditation",
)


class CurriculumRecordError(ValueError):
    """Base class for curriculum record failures."""


class CurriculumRecordStructureError(CurriculumRecordError):
    """The record is not shaped like the Stage 8A curriculum contract."""


class CurriculumRecordIdentityError(CurriculumRecordError):
    """An identifier is missing, duplicated, or points at no record."""


class CurriculumRecordProvenanceError(CurriculumRecordError):
    """Provenance is missing, or claims a source kind it cannot have."""


class CurriculumRecordSkillError(CurriculumRecordError):
    """A course skill mapping is missing, duplicated, or names an unknown role."""


@dataclass(frozen=True)
class _Vocabulary:
    """The join vocabulary every skill mapping in one record is resolved against."""

    skills: tuple[str, ...]
    roles: tuple[str, ...]
    artifact_only_skills: tuple[str, ...]

    @classmethod
    def build(cls, *, directory: Optional[Path]) -> "_Vocabulary":
        built = build_skill_vocabulary(directory=directory)
        return cls(
            skills=tuple(built["skills"]),
            roles=tuple(artifact_roles(directory=directory)),
            artifact_only_skills=tuple(built["artifact_only_skills"]),
        )


def default_curricula_directory() -> Path:
    """Return the directory curriculum records are read from."""
    return Path(__file__).resolve().parent / CURRICULA_DIRECTORY_NAME


def default_curriculum_path() -> Path:
    return default_curricula_directory() / CURRICULUM_RECORD_FILE_NAME


# --------------------------------------------------------------------- reading


def load_curriculum_document(
    *, curriculum_directory: Optional[Path] = None
) -> dict[str, object]:
    """Read the curriculum document without validating it."""
    directory = (
        curriculum_directory
        if curriculum_directory is not None
        else default_curricula_directory()
    )
    path = Path(directory) / CURRICULUM_RECORD_FILE_NAME
    if not path.is_file():
        raise CurriculumRecordError(f"No curriculum record at {path}.")
    with path.open(encoding="utf-8") as handle:
        document = json.load(handle)
    if not isinstance(document, dict):
        raise CurriculumRecordStructureError(
            f"{CURRICULUM_RECORD_FILE_NAME} must contain a JSON object at the top level."
        )
    return document


# ------------------------------------------------------------------ primitives


def _mapping(value: object, *, field: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise CurriculumRecordStructureError(f"{field} must be an object.")
    return value


def _sequence(value: object, *, field: str) -> Sequence[object]:
    if isinstance(value, (str, bytes)) or not isinstance(value, Sequence):
        raise CurriculumRecordStructureError(f"{field} must be a list.")
    return value


def _identifier(value: object, *, field: str) -> str:
    """Return an opaque identifier, stripped at the edges and otherwise untouched.

    Identifiers are case-preserving and compared exactly. Course identity is never
    normalized the way a skill name is, because two courses that differ only in
    case are two courses.
    """
    if not isinstance(value, str) or not value.strip():
        raise CurriculumRecordIdentityError(f"{field} must be a non-empty string.")
    return value.strip()


def _optional_identifier(value: object, *, field: str) -> Optional[str]:
    if value is None:
        return None
    return _identifier(value, field=field)


def _optional_text(value: object, *, field: str) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        raise CurriculumRecordStructureError(f"{field} must be a string or null.")
    return value


def _optional_bool(value: object, *, field: str) -> Optional[bool]:
    if value is None or isinstance(value, bool):
        return value
    raise CurriculumRecordStructureError(f"{field} must be true, false, or null.")


def _optional_number(
    value: object, *, field: str, minimum: float = 0.0
) -> Optional[object]:
    """Return a finite number at or above ``minimum``, preserved exactly as written.

    The value is never coerced, so a recorded ``4`` stays an ``int`` and ``4.5``
    keeps its fraction. No total, average, or sum is invented here.
    """
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise CurriculumRecordStructureError(f"{field} must be a number or null.")
    if not isfinite(value):
        raise CurriculumRecordStructureError(f"{field} must be a finite number.")
    if value < minimum:
        raise CurriculumRecordStructureError(
            f"{field} must be greater than or equal to {minimum}."
        )
    return value


def _required_string(
    value: object, *, field: str, choices: Optional[Sequence[str]] = None
) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CurriculumRecordStructureError(f"{field} must be a non-empty string.")
    text = value.strip()
    if choices is not None and text not in choices:
        raise CurriculumRecordStructureError(
            f"{field} must be one of {', '.join(choices)}; got {text!r}."
        )
    return text


def _enum_or_null(
    value: object, *, field: str, choices: Sequence[str]
) -> Optional[str]:
    if value is None:
        return None
    return _required_string(value, field=field, choices=choices)


def _object_list(value: object, *, field: str) -> list[Mapping[str, object]]:
    if value is None:
        return []
    return [
        _mapping(entry, field=f"{field}[{index}]")
        for index, entry in enumerate(_sequence(value, field=field))
    ]


def _duplicates(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    repeated: set[str] = set()
    for value in values:
        if value in seen:
            repeated.add(value)
        seen.add(value)
    return sorted(repeated)


# ------------------------------------------------------------------- provenance


def _normalize_provenance(
    value: object, *, field: str, demo: bool
) -> dict[str, object]:
    raw = _mapping(value, field=field)
    kind = _required_string(raw.get("kind"), field=f"{field}.kind")
    allowed = DEMO_PROVENANCE_KINDS if demo else PROVENANCE_KINDS
    if kind not in allowed:
        raise CurriculumRecordProvenanceError(
            f"{field}.kind is {kind!r}, which this record kind may not claim. "
            f"Allowed: {', '.join(allowed)}."
        )
    return {
        "kind": kind,
        "reference": _optional_text(
            raw.get("reference"), field=f"{field}.reference"
        ),
        "recorded_at": _optional_text(
            raw.get("recorded_at"), field=f"{field}.recorded_at"
        ),
        "verified": _optional_bool(raw.get("verified"), field=f"{field}.verified"),
        "note": _optional_text(raw.get("note"), field=f"{field}.note"),
    }


# ---------------------------------------------------------------- prerequisites


def _normalize_prerequisites(value: object, *, field: str) -> dict[str, object]:
    raw = _mapping(value, field=field)
    recorded = raw.get("recorded")
    if not isinstance(recorded, bool):
        raise CurriculumRecordStructureError(
            f"{field}.recorded must be true or false."
        )
    course_ids: list[str] = []
    for index, entry in enumerate(
        _sequence(raw.get("course_ids"), field=f"{field}.course_ids")
    ):
        course_ids.append(_identifier(entry, field=f"{field}.course_ids[{index}]"))
    duplicates = _duplicates(course_ids)
    if duplicates:
        raise CurriculumRecordIdentityError(
            f"{field}.course_ids lists {', '.join(duplicates)} more than once."
        )
    if not recorded and course_ids:
        raise CurriculumRecordStructureError(
            f"{field} records prerequisites ({', '.join(course_ids)}) while "
            f"{field}.recorded is false."
        )
    return {"recorded": recorded, "course_ids": course_ids}


# ---------------------------------------------------------------- course skills


def _normalize_course_skill(
    value: object, *, field: str, vocabulary: _Vocabulary, demo: bool
) -> dict[str, object]:
    raw = _mapping(value, field=field)
    skill = normalize_skill(_required_string(raw.get("skill"), field=f"{field}.skill"))
    resolution = resolve_skill_name(skill, vocabulary.skills)

    recorded_match = _enum_or_null(
        raw.get("match_type"), field=f"{field}.match_type", choices=MATCH_TYPES
    )
    if recorded_match is not None and recorded_match != resolution.match_type:
        raise CurriculumRecordSkillError(
            f"{field}.match_type is {recorded_match!r} but {skill!r} resolves as "
            f"{resolution.match_type!r}. A recorded match type must agree with the "
            f"union vocabulary."
        )

    # The adapter falls back to the normalized name as the canonical skill when a
    # name is unmatched. The contract is stricter: an unmatched name has no
    # canonical skill, because naming one would imply the vocabulary contains it.
    canonical_skill = (
        None if resolution.match_type == "unmatched" else resolution.canonical_skill
    )
    recorded_canonical = _optional_identifier(
        raw.get("canonical_skill"), field=f"{field}.canonical_skill"
    )
    if recorded_canonical is not None and recorded_canonical != canonical_skill:
        raise CurriculumRecordSkillError(
            f"{field}.canonical_skill is {recorded_canonical!r} but {skill!r} "
            f"resolves to {canonical_skill!r}."
        )

    role_categories: list[str] = []
    for index, entry in enumerate(
        _sequence(raw.get("role_categories"), field=f"{field}.role_categories")
    ):
        role = normalize_role(
            _required_string(entry, field=f"{field}.role_categories[{index}]")
        )
        if role not in vocabulary.roles:
            raise CurriculumRecordSkillError(
                f"{field}.role_categories[{index}] is {role!r}, which the artifacts do "
                f"not record. Known roles: {', '.join(vocabulary.roles)}."
            )
        if role not in role_categories:
            role_categories.append(role)

    return {
        "input_skill": _optional_text(
            raw.get("input_skill"), field=f"{field}.input_skill"
        ),
        "skill": skill,
        "canonical_skill": canonical_skill,
        "match_type": resolution.match_type,
        "role_categories": role_categories,
        "coverage": _optional_text(raw.get("coverage"), field=f"{field}.coverage"),
        "notes": _optional_text(raw.get("notes"), field=f"{field}.notes"),
        "source": _normalize_provenance(
            raw.get("source"), field=f"{field}.source", demo=demo
        ),
    }


def _normalize_course(
    value: object, *, field: str, vocabulary: _Vocabulary, demo: bool
) -> dict[str, object]:
    raw = _mapping(value, field=field)
    skills: list[dict[str, object]] = []
    for index, entry in enumerate(
        _object_list(raw.get("skills"), field=f"{field}.skills")
    ):
        skills.append(
            _normalize_course_skill(
                entry,
                field=f"{field}.skills[{index}]",
                vocabulary=vocabulary,
                demo=demo,
            )
        )
    duplicate_skills = _duplicates([str(skill["skill"]) for skill in skills])
    if duplicate_skills:
        raise CurriculumRecordSkillError(
            f"{field}.skills maps {', '.join(duplicate_skills)} more than once."
        )
    skills.sort(key=lambda skill: str(skill["skill"]))

    return {
        "course_id": _identifier(raw.get("course_id"), field=f"{field}.course_id"),
        "name": _required_string(raw.get("name"), field=f"{field}.name"),
        "code": _optional_text(raw.get("code"), field=f"{field}.code"),
        "credits": _optional_number(raw.get("credits"), field=f"{field}.credits"),
        "hours": _optional_number(raw.get("hours"), field=f"{field}.hours"),
        "description": _optional_text(
            raw.get("description"), field=f"{field}.description"
        ),
        "level": _optional_text(raw.get("level"), field=f"{field}.level"),
        "delivery_format": _optional_text(
            raw.get("delivery_format"), field=f"{field}.delivery_format"
        ),
        "is_elective": _optional_bool(
            raw.get("is_elective"), field=f"{field}.is_elective"
        ),
        "prerequisites": _normalize_prerequisites(
            raw.get("prerequisites"), field=f"{field}.prerequisites"
        ),
        "skills": skills,
        "source": _normalize_provenance(
            raw.get("source"), field=f"{field}.source", demo=demo
        ),
    }


# ------------------------------------------------------- semesters and years


def _semester_sort_key(semester: Mapping[str, object]) -> tuple[int, object, str]:
    """Order semesters by recorded sequence, then by id.

    Recorded order is honoured when the record provides one; semesters without a
    sequence keep their id order after the recorded ones. Both branches are total,
    so the same document always serializes the same way.
    """
    sequence = semester["sequence"]
    if isinstance(sequence, (int, float)) and not isinstance(sequence, bool):
        return (0, sequence, str(semester["semester_id"]))
    return (1, 0, str(semester["semester_id"]))


def _normalize_semester(
    value: object, *, field: str, vocabulary: _Vocabulary, demo: bool
) -> dict[str, object]:
    raw = _mapping(value, field=field)
    courses = [
        _normalize_course(
            entry, field=f"{field}.courses[{index}]", vocabulary=vocabulary, demo=demo
        )
        for index, entry in enumerate(
            _object_list(raw.get("courses"), field=f"{field}.courses")
        )
    ]
    courses.sort(key=lambda course: str(course["course_id"]))
    return {
        "semester_id": _identifier(
            raw.get("semester_id"), field=f"{field}.semester_id"
        ),
        "sequence": _optional_number(
            raw.get("sequence"), field=f"{field}.sequence", minimum=1.0
        ),
        "term": _enum_or_null(
            raw.get("term"), field=f"{field}.term", choices=SEMESTER_TERMS
        ),
        "label": _optional_text(raw.get("label"), field=f"{field}.label"),
        "start_date": _optional_text(
            raw.get("start_date"), field=f"{field}.start_date"
        ),
        "end_date": _optional_text(raw.get("end_date"), field=f"{field}.end_date"),
        "recorded_credits": _optional_number(
            raw.get("recorded_credits"), field=f"{field}.recorded_credits"
        ),
        "courses": courses,
        "source": _normalize_provenance(
            raw.get("source"), field=f"{field}.source", demo=demo
        ),
    }


def _normalize_academic_year(
    value: object, *, field: str, vocabulary: _Vocabulary, demo: bool
) -> dict[str, object]:
    raw = _mapping(value, field=field)
    semesters = [
        _normalize_semester(
            entry,
            field=f"{field}.semesters[{index}]",
            vocabulary=vocabulary,
            demo=demo,
        )
        for index, entry in enumerate(
            _object_list(raw.get("semesters"), field=f"{field}.semesters")
        )
    ]
    semesters.sort(key=_semester_sort_key)
    duplicates = _duplicates([str(semester["semester_id"]) for semester in semesters])
    if duplicates:
        raise CurriculumRecordIdentityError(
            f"{field} repeats semester_id {', '.join(duplicates)}."
        )
    return {
        "academic_year_id": _identifier(
            raw.get("academic_year_id"), field=f"{field}.academic_year_id"
        ),
        "label": _optional_text(raw.get("label"), field=f"{field}.label"),
        "start_year": _optional_number(
            raw.get("start_year"), field=f"{field}.start_year"
        ),
        "end_year": _optional_number(raw.get("end_year"), field=f"{field}.end_year"),
        "is_entry_cohort": _optional_bool(
            raw.get("is_entry_cohort"), field=f"{field}.is_entry_cohort"
        ),
        "semesters": semesters,
        "source": _normalize_provenance(
            raw.get("source"), field=f"{field}.source", demo=demo
        ),
    }


# ------------------------------------------------------------------ programmes


def _normalize_version(
    value: object, *, field: str, vocabulary: _Vocabulary, demo: bool
) -> dict[str, object]:
    raw = _mapping(value, field=field)
    academic_years = [
        _normalize_academic_year(
            entry,
            field=f"{field}.academic_years[{index}]",
            vocabulary=vocabulary,
            demo=demo,
        )
        for index, entry in enumerate(
            _object_list(raw.get("academic_years"), field=f"{field}.academic_years")
        )
    ]
    academic_years.sort(key=lambda year: str(year["academic_year_id"]))
    duplicates = _duplicates([str(year["academic_year_id"]) for year in academic_years])
    if duplicates:
        raise CurriculumRecordIdentityError(
            f"{field} repeats academic_year_id {', '.join(duplicates)}."
        )
    return {
        "version_id": _identifier(raw.get("version_id"), field=f"{field}.version_id"),
        "version_label": _optional_text(
            raw.get("version_label"), field=f"{field}.version_label"
        ),
        "effective_from": _optional_text(
            raw.get("effective_from"), field=f"{field}.effective_from"
        ),
        "effective_to": _optional_text(
            raw.get("effective_to"), field=f"{field}.effective_to"
        ),
        "status": _enum_or_null(
            raw.get("status"), field=f"{field}.status", choices=VERSION_STATUSES
        ),
        "total_credits": _optional_number(
            raw.get("total_credits"), field=f"{field}.total_credits"
        ),
        "academic_years": academic_years,
        "source": _normalize_provenance(
            raw.get("source"), field=f"{field}.source", demo=demo
        ),
    }


def _normalize_programme(
    value: object, *, field: str, vocabulary: _Vocabulary, demo: bool
) -> dict[str, object]:
    raw = _mapping(value, field=field)
    versions = [
        _normalize_version(
            entry,
            field=f"{field}.curricula[{index}]",
            vocabulary=vocabulary,
            demo=demo,
        )
        for index, entry in enumerate(
            _object_list(raw.get("curricula"), field=f"{field}.curricula")
        )
    ]
    versions.sort(key=lambda version: str(version["version_id"]))
    duplicates = _duplicates([str(version["version_id"]) for version in versions])
    if duplicates:
        raise CurriculumRecordIdentityError(
            f"{field} repeats version_id {', '.join(duplicates)}."
        )
    return {
        "programme_id": _identifier(
            raw.get("programme_id"), field=f"{field}.programme_id"
        ),
        "name": _required_string(raw.get("name"), field=f"{field}.name"),
        "institution_name": _optional_text(
            raw.get("institution_name"), field=f"{field}.institution_name"
        ),
        "award": _optional_text(raw.get("award"), field=f"{field}.award"),
        "faculty": _optional_text(raw.get("faculty"), field=f"{field}.faculty"),
        "duration_terms": _optional_number(
            raw.get("duration_terms"), field=f"{field}.duration_terms", minimum=1.0
        ),
        "total_credits": _optional_number(
            raw.get("total_credits"), field=f"{field}.total_credits"
        ),
        "curricula": versions,
        "source": _normalize_provenance(
            raw.get("source"), field=f"{field}.source", demo=demo
        ),
    }


# ---------------------------------------------------- cross-level observations


def _collect_placements(
    programmes: Sequence[Mapping[str, object]]
) -> dict[str, dict[str, object]]:
    """Flatten a record to one placement per course id.

    Course ids must be unique across the whole record, so a repeated id is a data
    error rather than two courses that happen to share a name.
    """
    placements: dict[str, dict[str, object]] = {}
    for programme in programmes:
        for version in programme["curricula"]:
            for year in version["academic_years"]:
                for semester in year["semesters"]:
                    for course in semester["courses"]:
                        course_id = str(course["course_id"])
                        if course_id in placements:
                            raise CurriculumRecordIdentityError(
                                f"course_id {course_id!r} appears more than once in the record."
                            )
                        placements[course_id] = {
                            "course": course,
                            "programme_id": programme["programme_id"],
                            "version_id": version["version_id"],
                            "academic_year_id": year["academic_year_id"],
                            "semester_id": semester["semester_id"],
                        }
    return placements


def _dangling_prerequisites(
    placements: Mapping[str, Mapping[str, object]]
) -> list[dict[str, str]]:
    dangling = []
    for course_id in sorted(placements):
        prerequisites = placements[course_id]["course"]["prerequisites"]
        if not prerequisites["recorded"]:
            continue
        for prerequisite in prerequisites["course_ids"]:
            if str(prerequisite) not in placements:
                dangling.append(
                    {"course_id": course_id, "prerequisite_course_id": str(prerequisite)}
                )
    return dangling


def _prerequisite_graph(
    placements: Mapping[str, Mapping[str, object]]
) -> dict[str, list[str]]:
    """Build the prerequisite graph, omitting only unresolvable references.

    An edge to a course id the record does not define is left out so cycle
    detection does not treat a missing course as a node. The edge stays on the
    course itself and is reported as a dangling prerequisite, so nothing is lost.
    """
    graph: dict[str, list[str]] = {}
    for course_id in sorted(placements):
        prerequisites = placements[course_id]["course"]["prerequisites"]
        if not prerequisites["recorded"]:
            continue
        graph[course_id] = sorted(
            str(entry)
            for entry in prerequisites["course_ids"]
            if str(entry) in placements
        )
    return graph


def _ordering_observations(
    programmes: Sequence[Mapping[str, object]],
    placements: Mapping[str, Mapping[str, object]],
) -> list[dict[str, object]]:
    """Report a prerequisite recorded in a later semester than the course.

    This is an observation, not a repair. Nothing is reordered, because a
    curriculum may legitimately record a prerequisite in a later semester and only
    the record's author knows whether that is an error.
    """
    rank: dict[str, tuple[str, int]] = {}
    for programme in programmes:
        for version in programme["curricula"]:
            for year in version["academic_years"]:
                year_id = str(year["academic_year_id"])
                for index, semester in enumerate(year["semesters"]):
                    for course in semester["courses"]:
                        rank[str(course["course_id"])] = (year_id, index)

    observations = []
    for course_id in sorted(placements):
        prerequisites = placements[course_id]["course"]["prerequisites"]
        if not prerequisites["recorded"]:
            continue
        for prerequisite in prerequisites["course_ids"]:
            course_rank = rank.get(course_id)
            prerequisite_rank = rank.get(str(prerequisite))
            if course_rank is None or prerequisite_rank is None:
                continue
            if prerequisite_rank > course_rank:
                observations.append(
                    {
                        "course_id": course_id,
                        "prerequisite_course_id": str(prerequisite),
                        "course_semester_id": placements[course_id]["semester_id"],
                        "prerequisite_semester_id": placements[str(prerequisite)][
                            "semester_id"
                        ],
                        "observation": "prerequisite_recorded_in_a_later_semester",
                    }
                )
    return observations


def _validation_report(
    programmes: Sequence[Mapping[str, object]],
    placements: Mapping[str, Mapping[str, object]],
) -> dict[str, object]:
    cycles = find_dag_cycles(_prerequisite_graph(placements))
    all_skills = [
        str(skill["skill"])
        for course_id in sorted(placements)
        for skill in placements[course_id]["course"]["skills"]
    ]
    unmatched = [
        {
            "course_id": course_id,
            "skill": skill["skill"],
            "input_skill": skill["input_skill"],
        }
        for course_id in sorted(placements)
        for skill in placements[course_id]["course"]["skills"]
        if skill["match_type"] == "unmatched"
    ]
    return {
        "dangling_prerequisites": _dangling_prerequisites(placements),
        "unmatched_skills": unmatched,
        "courses_without_recorded_skills": sorted(
            course_id
            for course_id, placement in placements.items()
            if not placement["course"]["skills"]
        ),
        # Reported, never repaired. The cycles stay in the record so the later
        # recommendation layer can decide which placements to block.
        "prerequisite_cycles": cycles,
        "cycle_course_ids": sorted({node for cycle in cycles for node in cycle}),
        "ordering_observations": _ordering_observations(programmes, placements),
        "token_signature_collisions": token_signature_collisions(all_skills),
    }


# ------------------------------------------------------------------ the record


def validate_curriculum_document(
    document: Mapping[str, object], *, directory: Optional[Path] = None
) -> dict[str, object]:
    """Validate one curriculum document and return the normalized record.

    Raises on anything that would make the record ambiguous: an unsupported
    contract version, a missing or duplicated identifier, a prerequisite list that
    contradicts its own ``recorded`` flag, a skill mapping that disagrees with the
    union vocabulary, a role the artifacts do not know, or a demonstration record
    that fails to declare itself. Anything merely incomplete is reported under
    ``validation`` instead of raising.
    """
    vocabulary = _Vocabulary.build(directory=directory)

    version = _required_string(
        document.get("contract_version"), field="contract_version"
    )
    if version != CONTRACT_VERSION:
        raise CurriculumRecordStructureError(
            f"contract_version is {version!r}; this service serves "
            f"{CONTRACT_VERSION!r} only."
        )

    record_kind = _required_string(
        document.get("record_kind"), field="record_kind", choices=RECORD_KINDS
    )
    demo = record_kind == "demonstration"
    is_demo = _optional_bool(document.get("is_demo"), field="is_demo")
    if is_demo is not None and is_demo != demo:
        raise CurriculumRecordStructureError(
            f"is_demo is {is_demo!r} but record_kind is {record_kind!r}."
        )

    label = _optional_text(document.get("label"), field="label")
    disclaimer = _optional_text(document.get("disclaimer"), field="disclaimer")
    if demo and (not label or not disclaimer):
        raise CurriculumRecordStructureError(
            "A demonstration record must carry both a label and a disclaimer."
        )

    programmes = [
        _normalize_programme(
            entry,
            field=f"programmes[{index}]",
            vocabulary=vocabulary,
            demo=demo,
        )
        for index, entry in enumerate(
            _object_list(document.get("programmes"), field="programmes")
        )
    ]
    programmes.sort(key=lambda programme: str(programme["programme_id"]))
    duplicates = _duplicates([str(entry["programme_id"]) for entry in programmes])
    if duplicates:
        raise CurriculumRecordIdentityError(
            f"programmes repeats programme_id {', '.join(duplicates)}."
        )

    not_recorded = set(CURRICULUM_RECORD_NOT_AVAILABLE)
    for index, entry in enumerate(
        _sequence(document.get("not_recorded", []), field="not_recorded")
    ):
        not_recorded.add(_required_string(entry, field=f"not_recorded[{index}]"))

    placements = _collect_placements(programmes)

    return {
        "contract_version": version,
        "record_id": _identifier(document.get("record_id"), field="record_id"),
        "record_kind": record_kind,
        "is_demo": demo,
        "is_representative": _optional_bool(
            document.get("is_representative"), field="is_representative"
        ),
        "label": label,
        "disclaimer": disclaimer,
        "source": _normalize_provenance(
            document.get("source"), field="source", demo=demo
        ),
        "not_recorded": sorted(not_recorded),
        "programmes": programmes,
        "validation": _validation_report(programmes, placements),
        "counts": {
            "programmes": len(programmes),
            "curriculum_versions": sum(
                len(entry["curricula"]) for entry in programmes
            ),
            "academic_years": sum(
                len(version["academic_years"])
                for entry in programmes
                for version in entry["curricula"]
            ),
            "semesters": sum(
                len(year["semesters"])
                for entry in programmes
                for version in entry["curricula"]
                for year in version["academic_years"]
            ),
            "courses": len(placements),
            "course_skill_mappings": sum(
                len(placement["course"]["skills"])
                for placement in placements.values()
            ),
        },
        "vocabulary": {
            "source": "adapters.build_skill_vocabulary",
            "size": len(vocabulary.skills),
            "artifact_only_skills": deepcopy(list(vocabulary.artifact_only_skills)),
        },
    }


def load_curriculum_record(
    *, directory: Optional[Path] = None, curriculum_directory: Optional[Path] = None
) -> dict[str, object]:
    """Read and validate the curriculum record."""
    document = load_curriculum_document(curriculum_directory=curriculum_directory)
    return validate_curriculum_document(document, directory=directory)


# -------------------------------------------------------------------- coverage


def _semester_coverage(
    programmes: Sequence[Mapping[str, object]],
    industry_names: frozenset[str],
) -> list[dict[str, object]]:
    """One coverage entry per semester, in recorded order.

    ``recorded_credit_sum`` is stated only when every course in the semester
    recorded a credit value. A partial sum would read as a semester total the
    record does not support, so it is reported as null instead.
    """
    semesters: list[dict[str, object]] = []
    for programme in programmes:
        for version in programme["curricula"]:
            for year in version["academic_years"]:
                for semester in year["semesters"]:
                    courses: list[dict[str, object]] = []
                    with_skills = 0
                    with_credits = 0
                    for course in semester["courses"]:
                        skills = course["skills"]
                        if skills:
                            with_skills += 1
                        if course["credits"] is not None:
                            with_credits += 1
                        courses.append(
                            {
                                "course_id": course["course_id"],
                                "name": course["name"],
                                "code": course["code"],
                                "credits": course["credits"],
                                "skill_count": len(skills),
                                "skills": [str(skill["skill"]) for skill in skills],
                                "matched_industry_skills": sorted(
                                    {
                                        str(skill["canonical_skill"])
                                        for skill in skills
                                        if skill["canonical_skill"] in industry_names
                                    }
                                ),
                            }
                        )
                    total = len(courses)
                    semesters.append(
                        {
                            "programme_id": programme["programme_id"],
                            "version_id": version["version_id"],
                            "academic_year_id": year["academic_year_id"],
                            "semester_id": semester["semester_id"],
                            "sequence": semester["sequence"],
                            "term": semester["term"],
                            "course_count": total,
                            "courses_with_recorded_skills": with_skills,
                            "courses_without_recorded_skills": total - with_skills,
                            "courses_with_recorded_credits": with_credits,
                            "recorded_credit_sum": (
                                sum(
                                    course["credits"]
                                    for course in semester["courses"]
                                    if course["credits"] is not None
                                )
                                if total > 0 and with_credits == total
                                else None
                            ),
                            "courses": courses,
                        }
                    )
    semesters.sort(
        key=lambda entry: (
            str(entry["programme_id"]),
            str(entry["version_id"]),
            str(entry["academic_year_id"]),
            _semester_sort_key(entry),
        )
    )
    return semesters


def build_curriculum_skill_index(
    record: Mapping[str, object],
    *,
    directory: Optional[Path] = None,
    curriculum_directory: Optional[Path] = None,
) -> dict[str, object]:
    """Index a normalized record by canonical skill name.

    The join key is the canonical skill name, which is
    :func:`adapters.normalize_skill` applied to a recorded skill name and is the
    same string ``curriculum_intelligence`` publishes as ``skill``. So a
    curriculum skill joins an industry skill only on an exact normalized match,
    and two skills that merely share a token signature never join.

    An unmatched skill is left out of the index, because it has no canonical name
    to key on and therefore cannot cover an industry skill. It stays visible in the
    record's ``validation.unmatched_skills`` instead of being dropped.

    Shared by :func:`build_curriculum_coverage` and the Stage 8C gap engine so the
    join is written once and cannot drift between the two views.
    """
    placements = _collect_placements(record["programmes"])

    by_skill: dict[str, list[dict[str, object]]] = {}
    courses_by_skill: dict[str, set[str]] = {}
    for course_id in sorted(placements):
        placement = placements[course_id]
        for skill in placement["course"]["skills"]:
            if skill["match_type"] == "unmatched":
                continue
            canonical = str(skill["canonical_skill"])
            by_skill.setdefault(canonical, []).append(
                {
                    "course_id": course_id,
                    "name": placement["course"]["name"],
                    "code": placement["course"]["code"],
                    "credits": placement["course"]["credits"],
                    "academic_year_id": placement["academic_year_id"],
                    "semester_id": placement["semester_id"],
                    "recorded_skill": skill["skill"],
                    "input_skill": skill["input_skill"],
                    "match_type": skill["match_type"],
                    "coverage": skill["coverage"],
                    "source": deepcopy(skill["source"]),
                }
            )
            courses_by_skill.setdefault(canonical, set()).add(course_id)

    return {
        "placements": placements,
        "by_skill": by_skill,
        "courses_by_skill": courses_by_skill,
    }


def load_curriculum_gap_inputs(
    role: str,
    *,
    directory: Optional[Path] = None,
    curriculum_directory: Optional[Path] = None,
) -> dict[str, object]:
    """Load the curriculum record and one role's Stage 7 intelligence together.

    Both loaders are called once here so a consumer that needs the curriculum join
    and the Stage 7 caveat blocks does not have to call either twice.
    """
    record = load_curriculum_record(
        directory=directory, curriculum_directory=curriculum_directory
    )
    industry = build_role_curriculum_intelligence(role, directory=directory)
    index = build_curriculum_skill_index(
        record, directory=directory, curriculum_directory=curriculum_directory
    )
    return {
        "record": record,
        "industry": industry,
        "index": index,
        "industry_names": frozenset(
            str(row["skill"]) for row in industry["skills"]
        ),
    }


def build_curriculum_coverage(
    role: str,
    *,
    directory: Optional[Path] = None,
    curriculum_directory: Optional[Path] = None,
) -> dict[str, object]:
    """Join the curriculum record to one role's Stage 7 intelligence.

    The join key is :func:`adapters.normalize_skill` applied to a recorded skill
    name, which is the same name ``curriculum_intelligence`` publishes, so a
    curriculum skill joins an industry skill only on an exact normalized match.
    Every list is ordered, nothing is scored or ranked, and an unmatched
    curriculum skill is reported rather than resolved to the nearest name.

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
    courses_by_skill = inputs["index"]["courses_by_skill"]
    industry_names = inputs["industry_names"]

    covered: list[dict[str, object]] = []
    not_covered: list[dict[str, object]] = []
    for row in industry["skills"]:
        courses = by_skill.get(str(row["skill"]), [])
        entry = {key: deepcopy(value) for key, value in row.items()}
        entry["curriculum_courses"] = courses
        entry["is_covered"] = bool(courses)
        (covered if courses else not_covered).append(entry)

    without_industry_record = [
        {
            "skill": skill,
            "course_ids": sorted(courses_by_skill[skill]),
        }
        for skill in sorted(set(by_skill) - industry_names)
    ]

    return {
        "role_category": industry["role_category"],
        "record_id": record["record_id"],
        "is_demo": record["is_demo"],
        "disclaimer": record["disclaimer"],
        "industry": {
            "plannable": industry["plannable"],
            "corpus": deepcopy(industry["corpus"]),
            "velocity_slices": deepcopy(industry["velocity_slices"]),
            "skill_count": len(industry["skills"]),
        },
        "covered_skills": covered,
        "not_covered_skills": not_covered,
        "curriculum_skills_without_industry_record": without_industry_record,
        "semesters": _semester_coverage(record["programmes"], industry_names),
        "validation": deepcopy(record["validation"]),
        "not_available": sorted(
            set(record["not_recorded"]) | set(industry["not_available"])
        ),
    }
