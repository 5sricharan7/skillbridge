"""Stage 8B curriculum record tests.

These lock the two rules that were corrected during the Stage 8A review and the
honesty rules the rest of the contract depends on:

* ``normalize_skill`` is casefold-and-whitespace only. A hyphen is part of the
  skill name, so the demonstration record's unmatched skill is exactly
  ``"on-device inference"`` and is never rewritten to ``"on device inference"``.
* A prerequisite cycle is reported, never repaired. The record still loads, the
  cycle paths are published, and no course is reordered, dropped, or rewritten.
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.data.adapters import (
    UnknownTargetRoleError,
    build_skill_vocabulary,
    normalize_skill,
    resolve_skill_name,
)
from backend.data.curriculum_record import (
    CONTRACT_VERSION,
    CurriculumRecordError,
    CurriculumRecordIdentityError,
    CurriculumRecordProvenanceError,
    CurriculumRecordSkillError,
    CurriculumRecordStructureError,
    build_curriculum_coverage,
    default_curriculum_path,
    load_curriculum_record,
    validate_curriculum_document,
)
from backend.main import app


client = TestClient(app)

CURRICULA_DIR = Path(__file__).resolve().parents[1] / "data" / "curricula_demo"
ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "data" / "artifacts"


def _skill(skill, *, canonical=None, match_type="exact", roles=("data_science",)):
    entry = {
        "skill": skill,
        "input_skill": skill,
        "canonical_skill": canonical,
        "match_type": match_type,
        "role_categories": list(roles),
        "coverage": None,
        "notes": None,
        "source": {"kind": "manual_entry"},
    }
    return entry


def _course(course_id, *, prerequisites=None, skills=(), credits=None, name=None):
    return {
        "course_id": course_id,
        "name": name or course_id,
        "code": None,
        "credits": credits,
        "hours": None,
        "description": None,
        "level": None,
        "delivery_format": None,
        "is_elective": None,
        "source": {"kind": "manual_entry"},
        "prerequisites": prerequisites
        if prerequisites is not None
        else {"recorded": False, "course_ids": []},
        "skills": list(skills),
    }


def _semester(semester_id, courses):
    return {
        "semester_id": semester_id,
        "sequence": None,
        "term": None,
        "label": None,
        "start_date": None,
        "end_date": None,
        "recorded_credits": None,
        "source": {"kind": "demo"},
        "courses": list(courses),
    }


def _document(*, semesters, record_kind="demonstration", **overrides):
    """A minimal document that passes validation, for the negative cases."""
    document = {
        "contract_version": CONTRACT_VERSION,
        "record_id": "test_record",
        "record_kind": record_kind,
        "is_demo": record_kind == "demonstration",
        "is_representative": True,
        "label": "Test record" if record_kind == "demonstration" else None,
        "disclaimer": "Test only." if record_kind == "demonstration" else None,
        "source": {"kind": "demo" if record_kind == "demonstration" else "institution_export"},
        "not_recorded": [],
        "programmes": [
            {
                "programme_id": "test_programme",
                "name": "Test Programme",
                "institution_name": None,
                "award": None,
                "faculty": None,
                "duration_terms": None,
                "total_credits": None,
                "source": {"kind": "demo"},
                "curricula": [
                    {
                        "version_id": "test_version",
                        "version_label": None,
                        "effective_from": None,
                        "effective_to": None,
                        "status": None,
                        "total_credits": None,
                        "source": {"kind": "demo"},
                        "academic_years": [
                            {
                                "academic_year_id": "2026-2027",
                                "label": None,
                                "start_year": None,
                                "end_year": None,
                                "is_entry_cohort": None,
                                "source": {"kind": "demo"},
                                "semesters": list(semesters),
                            }
                        ],
                    }
                ],
            }
        ],
    }
    document.update(overrides)
    return document


# ------------------------------------------------- the demonstration record


def test_demo_record_lives_outside_the_artifact_directory() -> None:
    """The curriculum file must not land in ``artifacts/``.

    ``backend/tests/test_artifact_loaders.py`` asserts that directory's contents
    exactly, so a curriculum file there would break an existing test and become an
    untracked artifact.
    """
    assert default_curriculum_path().is_file()
    assert default_curriculum_path().parent == CURRICULA_DIR
    assert "curriculum" not in {path.name for path in ARTIFACTS_DIR.iterdir()}
    assert sorted(path.name for path in CURRICULA_DIR.iterdir()) == [
        "demo_curriculum.json"
    ]


def test_demo_record_validates_and_is_labelled_as_demo() -> None:
    record = load_curriculum_record()

    assert record["contract_version"] == CONTRACT_VERSION
    assert record["record_kind"] == "demonstration"
    assert record["is_demo"] is True
    assert record["label"]
    assert record["disclaimer"]
    assert record["counts"]["courses"] == 9
    assert record["counts"]["semesters"] == 4
    assert record["counts"]["academic_years"] == 2


def test_normalize_skill_preserves_hyphens() -> None:
    """The correction: normalization does not remove hyphens."""
    assert normalize_skill("on-device inference") == "on-device inference"
    assert normalize_skill("  On-Device   Inference  ") == "on-device inference"
    assert normalize_skill("on-device inference") != "on device inference"


def test_demo_unmatched_skill_is_exactly_the_hyphenated_name() -> None:
    record = load_curriculum_record()
    unmatched = record["validation"]["unmatched_skills"]

    assert [entry["skill"] for entry in unmatched] == ["on-device inference"]
    assert unmatched[0]["input_skill"] == "on-device inference"
    assert unmatched[0]["course_id"] == "DEMO-203"


def test_unmatched_skill_has_no_canonical_skill_and_covers_nothing() -> None:
    record = load_curriculum_record()
    courses = _all_courses(record)
    entry = courses["DEMO-203"]["skills"][0]

    assert entry["match_type"] == "unmatched"
    assert entry["canonical_skill"] is None
    assert entry["role_categories"] == []

    coverage = build_curriculum_coverage("data_science")
    covered = {skill["skill"] for skill in coverage["covered_skills"]}
    without_record = {
        entry["skill"] for entry in coverage["curriculum_skills_without_industry_record"]
    }
    assert "on-device inference" not in covered
    assert "on-device inference" not in without_record


def test_union_vocabulary_resolves_to_exact_not_the_alias() -> None:
    """A name already in the union is exact to itself.

    ``SKILL_ALIASES`` maps ``statistical analysis`` to ``statistics``, but that
    alias only applies to a vocabulary that lacks the name. Because the artifact
    vocabulary already contains it, resolution stops at ``exact``.
    """
    union = build_skill_vocabulary()["skills"]
    assert "statistical analysis" in union

    in_union = resolve_skill_name("statistical analysis", union)
    assert in_union.match_type == "exact"
    assert in_union.canonical_skill == "statistical analysis"

    outside_union = resolve_skill_name("statistical analysis", ("statistics",))
    assert outside_union.match_type == "explicit_alias"
    assert outside_union.canonical_skill == "statistics"

    record = load_curriculum_record()
    statistics = _skill_named(record, "statistical analysis")
    assert statistics["match_type"] == "exact"
    assert statistics["canonical_skill"] == "statistical analysis"


def test_demo_record_reports_dangling_and_skillless_courses() -> None:
    validation = load_curriculum_record()["validation"]

    assert validation["dangling_prerequisites"] == [
        {"course_id": "DEMO-205", "prerequisite_course_id": "DEMO-999"}
    ]
    assert validation["courses_without_recorded_skills"] == ["DEMO-204", "DEMO-205"]
    assert validation["token_signature_collisions"] == []


def test_dangling_prerequisite_stays_on_the_course() -> None:
    """A reference to a course that does not exist is reported, not deleted."""
    courses = _all_courses(load_curriculum_record())
    assert courses["DEMO-205"]["prerequisites"] == {
        "recorded": True,
        "course_ids": ["DEMO-999"],
    }


def test_record_is_deterministic() -> None:
    first = load_curriculum_record()
    second = load_curriculum_record()
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)


def test_no_coverage_percentage_is_published() -> None:
    """The service states coverage counts, never a coverage percentage."""
    coverage = build_curriculum_coverage("data_science")
    assert "coverage_percentage" in coverage["not_available"]
    for skill in coverage["covered_skills"]:
        assert "coverage_percentage" not in skill
        assert "coverage_score" not in skill


# ------------------------------------------------------- cycles are reported


def test_prerequisite_cycle_is_reported_and_the_record_still_loads() -> None:
    """Correction: detect and report cycle paths, never repair or reorder."""
    document = _document(
        semesters=[
            _semester(
                "s1",
                [
                    _course(
                        "CYCLE-A",
                        prerequisites={"recorded": True, "course_ids": ["CYCLE-B"]},
                    )
                ],
            ),
            _semester(
                "s2",
                [
                    _course(
                        "CYCLE-B",
                        prerequisites={"recorded": True, "course_ids": ["CYCLE-A"]},
                    )
                ],
            ),
        ]
    )

    record = validate_curriculum_document(document)

    assert record["validation"]["prerequisite_cycles"] == [["CYCLE-A", "CYCLE-B", "CYCLE-A"]]
    assert record["validation"]["cycle_course_ids"] == ["CYCLE-A", "CYCLE-B"]


def test_cycle_leaves_courses_where_they_were_recorded() -> None:
    """No edge dropped, no course moved, no course removed."""
    document = _document(
        semesters=[
            _semester(
                "s1",
                [
                    _course(
                        "CYCLE-A",
                        prerequisites={"recorded": True, "course_ids": ["CYCLE-B"]},
                    )
                ],
            ),
            _semester(
                "s2",
                [
                    _course(
                        "CYCLE-B",
                        prerequisites={"recorded": True, "course_ids": ["CYCLE-A"]},
                    )
                ],
            ),
        ]
    )

    record = validate_curriculum_document(document)
    placements = _semester_map(record)

    assert placements == {"CYCLE-A": "s1", "CYCLE-B": "s2"}
    assert _all_courses(record)["CYCLE-A"]["prerequisites"]["course_ids"] == ["CYCLE-B"]
    assert _all_courses(record)["CYCLE-B"]["prerequisites"]["course_ids"] == ["CYCLE-A"]
    assert record["counts"]["courses"] == 2


def test_acyclic_record_reports_no_cycles() -> None:
    assert load_curriculum_record()["validation"]["prerequisite_cycles"] == []


def test_self_prerequisite_is_reported_as_a_cycle() -> None:
    document = _document(
        semesters=[
            _semester(
                "s1",
                [
                    _course(
                        "LOOP",
                        prerequisites={"recorded": True, "course_ids": ["LOOP"]},
                    )
                ],
            )
        ]
    )

    record = validate_curriculum_document(document)
    assert record["validation"]["prerequisite_cycles"] == [["LOOP", "LOOP"]]


def test_prerequisite_in_a_later_semester_is_an_observation_only() -> None:
    document = _document(
        semesters=[
            _semester("s1", [_course("EARLY", prerequisites={"recorded": True, "course_ids": ["LATE"]})]),
            _semester("s2", [_course("LATE")]),
        ]
    )

    record = validate_curriculum_document(document)

    assert record["validation"]["ordering_observations"] == [
        {
            "course_id": "EARLY",
            "prerequisite_course_id": "LATE",
            "course_semester_id": "s1",
            "prerequisite_semester_id": "s2",
            "observation": "prerequisite_recorded_in_a_later_semester",
        }
    ]
    # Reported, not repaired: the courses stay in the semesters they were given.
    assert _semester_map(record) == {"EARLY": "s1", "LATE": "s2"}


# ------------------------------------------------------------ null vs absent


def test_recorded_false_and_recorded_empty_stay_different() -> None:
    document = _document(
        semesters=[
            _semester(
                "s1",
                [
                    _course("NOT-RECORDED", prerequisites={"recorded": False, "course_ids": []}),
                    _course("RECORDED-NONE", prerequisites={"recorded": True, "course_ids": []}),
                ],
            )
        ]
    )

    courses = _all_courses(validate_curriculum_document(document))

    assert courses["NOT-RECORDED"]["prerequisites"] == {
        "recorded": False,
        "course_ids": [],
    }
    assert courses["RECORDED-NONE"]["prerequisites"] == {
        "recorded": True,
        "course_ids": [],
    }


def test_zero_credits_is_not_null() -> None:
    document = _document(
        semesters=[_semester("s1", [_course("ZERO", credits=0)])]
    )

    assert _all_courses(validate_curriculum_document(document))["ZERO"]["credits"] == 0


def test_null_fields_are_not_coerced_to_empty_or_zero() -> None:
    courses = _all_courses(load_curriculum_record())
    course = courses["DEMO-101"]

    assert course["credits"] is None
    assert course["hours"] is None
    assert course["code"] is None
    assert course["level"] is None
    assert course["is_elective"] is None
    assert course["description"] is None
    assert course["skills"][0]["coverage"] is None


# ------------------------------------------------------- validation failures


def test_unsupported_contract_version_is_rejected() -> None:
    document = _document(semesters=[], contract_version="99")
    with pytest.raises(CurriculumRecordStructureError, match="contract_version"):
        validate_curriculum_document(document)


def test_demo_record_without_a_disclaimer_is_rejected() -> None:
    document = _document(semesters=[], disclaimer=None)
    with pytest.raises(CurriculumRecordStructureError, match="disclaimer"):
        validate_curriculum_document(document)


def test_demo_record_may_not_claim_an_institution_export() -> None:
    document = _document(semesters=[], source={"kind": "institution_export"})
    with pytest.raises(CurriculumRecordProvenanceError, match="institution_export"):
        validate_curriculum_document(document)


def test_unknown_role_category_is_rejected() -> None:
    document = _document(
        semesters=[
            _semester(
                "s1",
                [_course("C", skills=[_skill("python", roles=("astrophysics",))])],
            )
        ]
    )
    with pytest.raises(CurriculumRecordSkillError, match="astrophysics"):
        validate_curriculum_document(document)


def test_recorded_match_type_must_agree_with_the_vocabulary() -> None:
    document = _document(
        semesters=[
            _semester(
                "s1",
                [_course("C", skills=[_skill("python", match_type="unmatched")])],
            )
        ]
    )
    with pytest.raises(CurriculumRecordSkillError, match="match_type"):
        validate_curriculum_document(document)


def test_recorded_canonical_skill_must_agree_with_the_vocabulary() -> None:
    document = _document(
        semesters=[
            _semester(
                "s1",
                [_course("C", skills=[_skill("python", canonical="pythonn")])],
            )
        ]
    )
    with pytest.raises(CurriculumRecordSkillError, match="canonical_skill"):
        validate_curriculum_document(document)


def test_prerequisites_without_the_recorded_flag_are_rejected() -> None:
    document = _document(
        semesters=[
            _semester(
                "s1",
                [
                    _course("A", prerequisites={"recorded": True, "course_ids": ["B"]}),
                    _course("B", prerequisites={"recorded": False, "course_ids": ["A"]}),
                ],
            )
        ]
    )
    with pytest.raises(CurriculumRecordStructureError, match="recorded is false"):
        validate_curriculum_document(document)


def test_duplicate_course_id_in_one_semester_is_rejected() -> None:
    document = _document(semesters=[_semester("s1", [_course("SAME"), _course("SAME")])])
    with pytest.raises(CurriculumRecordIdentityError, match="more than once"):
        validate_curriculum_document(document)


def test_duplicate_skill_mapping_in_one_course_is_rejected() -> None:
    document = _document(
        semesters=[
            _semester(
                "s1",
                [_course("C", skills=[_skill("python"), _skill("python")])],
            )
        ]
    )
    with pytest.raises(CurriculumRecordSkillError, match="more than once"):
        validate_curriculum_document(document)


def test_negative_credits_are_rejected() -> None:
    document = _document(semesters=[_semester("s1", [_course("C", credits=-1)])])
    with pytest.raises(CurriculumRecordStructureError, match="greater than or equal"):
        validate_curriculum_document(document)


def test_non_numeric_credits_are_rejected() -> None:
    document = _document(semesters=[_semester("s1", [_course("C", credits="four")])])
    with pytest.raises(CurriculumRecordStructureError, match="must be a number"):
        validate_curriculum_document(document)


def test_boolean_credits_are_rejected() -> None:
    """``True`` is not ``1``: a boolean must never become a recorded quantity."""
    document = _document(semesters=[_semester("s1", [_course("C", credits=True)])])
    with pytest.raises(CurriculumRecordStructureError, match="must be a number"):
        validate_curriculum_document(document)


def test_missing_record_is_reported_clearly(tmp_path) -> None:
    with pytest.raises(CurriculumRecordError, match="No curriculum record"):
        load_curriculum_record(curriculum_directory=tmp_path)


# ---------------------------------------------------------------- coverage


def test_coverage_partitions_the_role_skills_without_inventing_a_score() -> None:
    from backend.data.curriculum_intelligence import build_role_curriculum_intelligence

    coverage = build_curriculum_coverage("data_science")
    covered = {skill["skill"] for skill in coverage["covered_skills"]}
    not_covered = {skill["skill"] for skill in coverage["not_covered_skills"]}

    assert covered
    assert not_covered
    # The two lists partition the role's recorded skills: nothing is dropped and
    # nothing is counted twice.
    assert covered.isdisjoint(not_covered)
    assert covered | not_covered == {
        row["skill"] for row in build_role_curriculum_intelligence("data_science")["skills"]
    }
    assert len(covered) + len(not_covered) == coverage["industry"]["skill_count"]


def test_coverage_joins_on_the_normalized_skill_name() -> None:
    coverage = build_curriculum_coverage("data_science")
    python = next(
        skill for skill in coverage["covered_skills"] if skill["skill"] == "python"
    )

    # Python is recorded by two courses, in two academic years.
    assert sorted(course["course_id"] for course in python["curriculum_courses"]) == [
        "DEMO-102",
        "DEMO-201",
    ]


def test_coverage_keeps_stage7_rows_verbatim() -> None:
    """Coverage must not restate an industry field; it joins the Stage 7 row."""
    from backend.data.curriculum_intelligence import build_role_curriculum_intelligence

    coverage = build_curriculum_coverage("data_science")
    industry = build_role_curriculum_intelligence("data_science")
    by_name = {row["skill"]: row for row in industry["skills"]}

    for skill in coverage["covered_skills"] + coverage["not_covered_skills"]:
        original = by_name[skill["skill"]]
        assert skill["frequency"] == original["frequency"]
        assert skill["classification"] == original["classification"]
        assert skill["velocity_score"] == original["velocity_score"]
        assert skill["hours"] == original["hours"]


def test_coverage_reports_both_directions_separately() -> None:
    """`not_covered` counts industry skills no course records; the other list
    counts curriculum skills the role's artifacts say nothing about."""
    coverage = build_curriculum_coverage("data_science")
    without_record = {
        entry["skill"] for entry in coverage["curriculum_skills_without_industry_record"]
    }

    assert "git" in without_record
    covered = {skill["skill"] for skill in coverage["covered_skills"]}
    assert "git" not in covered


def test_coverage_semesters_report_counts_not_a_credit_total_when_absent() -> None:
    coverage = build_curriculum_coverage("data_science")
    semesters = {entry["semester_id"]: entry for entry in coverage["semesters"]}

    assert sorted(semesters) == [
        "2026-2027-s1",
        "2026-2027-s2",
        "2027-2028-s1",
        "2027-2028-s2",
    ]
    # No course in the demonstration record states a credit value.
    for entry in semesters.values():
        assert entry["courses_with_recorded_credits"] == 0
        assert entry["recorded_credit_sum"] is None


def test_coverage_credit_sum_requires_every_course() -> None:
    """A partial sum would read as a semester total the record does not state."""
    document = _document(
        semesters=[
            _semester(
                "s1",
                [_course("A", credits=10), _course("B", credits=None)],
            )
        ]
    )

    record = validate_curriculum_document(document)
    assert record["counts"]["courses"] == 2

    from backend.data.curriculum_record import _semester_coverage

    coverage = _semester_coverage(record["programmes"], frozenset())
    assert coverage[0]["courses_with_recorded_credits"] == 1
    assert coverage[0]["recorded_credit_sum"] is None


def test_coverage_credit_sum_is_stated_when_complete() -> None:
    from backend.data.curriculum_record import _semester_coverage

    document = _document(
        semesters=[_semester("s1", [_course("A", credits=10), _course("B", credits=15)])]
    )
    coverage = _semester_coverage(
        validate_curriculum_document(document)["programmes"], frozenset()
    )
    assert coverage[0]["recorded_credit_sum"] == 25


def test_coverage_rejects_a_role_the_artifacts_do_not_know() -> None:
    with pytest.raises(UnknownTargetRoleError):
        build_curriculum_coverage("embedded_systems_engineer")


def test_coverage_answers_the_corpus_only_role_without_claiming_coverage() -> None:
    coverage = build_curriculum_coverage("other")

    assert coverage["role_category"] == "other"
    assert coverage["industry"]["plannable"] is False
    assert coverage["covered_skills"] == []
    assert coverage["curriculum_skills_without_industry_record"]


def test_coverage_carries_the_demo_disclaimer() -> None:
    """A reader must never be able to mistake the demonstration for a real
    curriculum, so the disclaimer travels with every served response."""
    assert build_curriculum_coverage("data_science")["disclaimer"]
    assert load_curriculum_record()["disclaimer"]


# ------------------------------------------------------------------- routes


def test_curriculum_record_route_serves_the_record() -> None:
    response = client.get("/curriculum-record")

    assert response.status_code == 200
    payload = response.json()
    assert payload["contract_version"] == CONTRACT_VERSION
    assert payload["is_demo"] is True
    assert payload["counts"]["courses"] == 9


def test_curriculum_coverage_route_serves_the_join() -> None:
    response = client.get("/curriculum-coverage/data_science")

    assert response.status_code == 200
    payload = response.json()
    assert payload["role_category"] == "data_science"
    assert payload["covered_skills"]
    assert payload["not_covered_skills"]


def test_curriculum_coverage_route_rejects_an_unknown_role() -> None:
    response = client.get("/curriculum-coverage/embedded_systems_engineer")

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "data_science" in detail["valid_roles"]
    assert "backend_ml_engineer" in detail["valid_roles"]


def test_existing_routes_are_still_served() -> None:
    """8B is additive: the routes Stage 7 already published still answer."""
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/curriculum-intelligence/data_science").status_code == 200
    assert client.get("/curriculum-intelligence/nope").status_code == 422
    assert client.get("/velocity/python").status_code == 200
    assert client.get("/proofs").status_code == 200
    assert client.get("/vendor-flags").json() == []


def test_no_curriculum_route_reads_the_velocity_fixture() -> None:
    """The synthetic ``/velocity/{skill}`` source must stay out of 8B."""
    source = Path(__file__).resolve().parents[1] / "data" / "curriculum_record.py"
    text = source.read_text(encoding="utf-8")

    assert "get_skill_velocity" not in text
    assert "velocity_engine" not in text
    assert "SAMPLE_VELOCITY_HISTORY" not in text


# ------------------------------------------------------------------ helpers


def _all_courses(record):
    return {
        course["course_id"]: course
        for programme in record["programmes"]
        for version in programme["curricula"]
        for year in version["academic_years"]
        for semester in year["semesters"]
        for course in semester["courses"]
    }


def _semester_map(record):
    return {
        course["course_id"]: semester["semester_id"]
        for programme in record["programmes"]
        for version in programme["curricula"]
        for year in version["academic_years"]
        for semester in year["semesters"]
        for course in semester["courses"]
    }


def _skill_named(record, name):
    for course in _all_courses(record).values():
        for skill in course["skills"]:
            if skill["skill"] == name:
                return skill
    raise AssertionError(f"{name!r} is not mapped by the record")
