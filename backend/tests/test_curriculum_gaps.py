"""Stage 8C curriculum gap engine tests.

These lock the explainability and honesty rules the gap dataset depends on:

* covered is an industry skill mapped to at least one curriculum course; not
  covered is an industry skill mapped to none of them.
* A curriculum skill Stage 7 never recorded is ``no_industry_record``: not a gap
  and not coverage.
* An unmatched curriculum skill stays visible and is claimed to cover nothing.
* Stage 7 fields are preserved verbatim, including every ``null``, so an
  insufficient-data state stays an insufficient-data state.
* Nothing is scored, weighted, ranked, or expressed as a percentage.
* Output is deterministic, and no earlier endpoint changes behavior.
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.data.adapters import UnknownTargetRoleError
from backend.data.curriculum_gaps import (
    COVERAGE_BASIS,
    COVERAGE_STATUS_COVERED,
    COVERAGE_STATUS_GAP,
    COVERAGE_STATUS_NO_INDUSTRY_RECORD,
    COVERAGE_STATUS_UNMATCHED,
    INDUSTRY_EVIDENCE_FIELDS,
    build_role_curriculum_gaps,
)
from backend.data.curriculum_intelligence import build_role_curriculum_intelligence
from backend.data.curriculum_record import CONTRACT_VERSION, build_curriculum_coverage, load_curriculum_record
from backend.main import app


client = TestClient(app)

ROLES = ("data_science", "backend_ml_engineer", "other")


def _by_skill(records, skill):
    matches = [record for record in records if record["skill"] == skill]
    assert len(matches) == 1, f"expected exactly one {skill!r} record, got {len(matches)}"
    return matches[0]


def _limitation_codes(record):
    return [limitation["code"] for limitation in record["evidence_limitations"]]


@pytest.fixture(scope="module")
def gaps():
    return build_role_curriculum_gaps("data_science")


# ---------------------------------------------------------------- 1. covered
def test_covered_skill_names_its_covering_course(gaps):
    covered = {record["skill"] for record in gaps["covered_skills"]}
    assert "deep learning" in covered
    assert "deep learning" not in {record["skill"] for record in gaps["gaps"]}


def test_covered_skill_explains_its_course_and_learning_record(gaps):
    record = _by_skill(gaps["covered_skills"], "deep learning")

    assert record["coverage_status"] == COVERAGE_STATUS_COVERED
    assert record["is_gap"] is False
    assert record["course_count"] == 1

    course = record["curriculum_courses"][0]
    assert course["course_id"] == "DEMO-202"
    assert course["name"] == "Deep Learning"
    # The join key, recorded as it was written in the course.
    assert course["recorded_skill"] == "deep learning"
    assert course["match_type"] == "exact"


def test_covered_skill_carries_hours_and_source_verbatim(gaps):
    record = _by_skill(gaps["covered_skills"], "deep learning")

    assert record["learning"]["recorded"] is True
    assert record["learning"]["hours"] == 24
    assert record["learning"]["hours_source"] == "heuristic; public ML/DL learning paths"


# ----------------------------------------------------------- 2. missing skill
def test_missing_skill_is_a_gap_with_no_courses(gaps):
    gaps_by_skill = {record["skill"] for record in gaps["gaps"]}
    assert "pandas" in gaps_by_skill
    assert "pandas" not in {record["skill"] for record in gaps["covered_skills"]}

    record = _by_skill(gaps["gaps"], "pandas")
    assert record["coverage_status"] == COVERAGE_STATUS_GAP
    assert record["is_gap"] is True
    assert record["curriculum_courses"] == []
    assert record["course_count"] == 0


def test_missing_skill_keeps_its_industry_evidence_and_says_why_it_is_a_gap(gaps):
    record = _by_skill(gaps["gaps"], "pandas")

    assert record["classification"] == "core"
    assert record["industry_evidence"]["frequency"] == pytest.approx(0.4151785714285714)
    assert record["industry_evidence"]["velocity_score"] == pytest.approx(
        -0.22330097087378642
    )
    assert record["industry_evidence"]["prerequisites"] == ["python"]
    assert record["prerequisites"] == ["python"]
    assert "no_curriculum_course" in _limitation_codes(record)


def test_no_gap_is_reported_as_covered_and_vice_versa(gaps):
    covered = {record["skill"] for record in gaps["covered_skills"]}
    gap_skills = {record["skill"] for record in gaps["gaps"]}
    assert covered.isdisjoint(gap_skills)
    assert covered | gap_skills == {
        record["skill"] for record in build_role_curriculum_intelligence(
            "data_science"
        )["skills"]
    }


# --------------------------------------------------------- 3. no_industry_record
def test_curriculum_skill_absent_from_stage_seven_is_not_a_gap(gaps):
    names = {record["skill"] for record in gaps["no_industry_record"]}
    assert names == {"git"}

    record = gaps["no_industry_record"][0]
    assert record["coverage_status"] == COVERAGE_STATUS_NO_INDUSTRY_RECORD
    assert record["is_gap"] is False
    assert record["skill"] not in {gap["skill"] for gap in gaps["gaps"]}
    assert record["skill"] not in {c["skill"] for c in gaps["covered_skills"]}


def test_no_industry_record_has_no_evidence_and_says_so(gaps):
    record = gaps["no_industry_record"][0]

    assert record["industry_evidence"] is None
    assert record["classification"] is None
    assert record["prerequisites"] is None
    assert record["learning"] == {"hours": None, "hours_source": None, "recorded": False}
    assert "no_industry_record" in _limitation_codes(record)


def test_no_industry_record_still_names_the_course_that_teaches_it(gaps):
    record = gaps["no_industry_record"][0]
    assert record["course_count"] == 1
    assert record["curriculum_courses"][0]["course_id"] == "DEMO-102"


def test_no_industry_record_is_absent_from_stage_seven_entirely(gaps):
    industry_skills = {
        row["skill"] for row in build_role_curriculum_intelligence("data_science")["skills"]
    }
    for record in gaps["no_industry_record"]:
        assert record["skill"] not in industry_skills


# ---------------------------------------------------- 4. unmatched curriculum skill
def test_unmatched_curriculum_skill_stays_visible(gaps):
    names = {record["skill"] for record in gaps["unmatched_curriculum_skills"]}
    assert names == {"on-device inference"}


def test_unmatched_curriculum_skill_is_never_a_gap_nor_coverage(gaps):
    record = gaps["unmatched_curriculum_skills"][0]

    assert record["coverage_status"] == COVERAGE_STATUS_UNMATCHED
    assert record["is_gap"] is False
    assert record["skill"] not in {gap["skill"] for gap in gaps["gaps"]}
    assert record["skill"] not in {c["skill"] for c in gaps["covered_skills"]}
    assert record["curriculum_courses"] == []
    assert record["industry_evidence"] is None


def test_unmatched_curriculum_skill_reports_the_recorded_spelling(gaps):
    record = gaps["unmatched_curriculum_skills"][0]
    # The hyphen is part of the name; it is never rewritten.
    assert record["input_skill"] == "on-device inference"
    assert "unmatched_curriculum_skill" in _limitation_codes(record)


def test_unmatched_skill_does_not_join_a_similarly_named_industry_skill(gaps):
    every_reported = (
        {record["skill"] for record in gaps["gaps"]}
        | {record["skill"] for record in gaps["covered_skills"]}
        | {record["skill"] for record in gaps["no_industry_record"]}
    )
    assert "on-device inference" not in every_reported


# ------------------------------------------------- 5. insufficient industry data
def test_gap_with_no_industry_velocity_keeps_every_null(gaps):
    record = _by_skill(gaps["gaps"], "aws")

    assert record["classification"] == "noise"
    assert record["industry_evidence"]["frequency"] == pytest.approx(
        0.004464285714285714
    )
    for field in ("velocity_score", "time_slices_used", "slices", "absolute_change"):
        assert record["industry_evidence"][field] is None


def test_gap_with_no_industry_velocity_names_what_is_missing(gaps):
    record = _by_skill(gaps["gaps"], "aws")
    codes = _limitation_codes(record)

    assert "industry_velocity_not_recorded" in codes
    assert "learning_hours_not_recorded" in codes
    assert "prerequisites_not_recorded" in codes
    # It is still a gap: no course covers it, and that is a recorded fact.
    assert record["is_gap"] is True
    assert record["learning"] == {"hours": None, "hours_source": None, "recorded": False}


def test_missing_hours_are_never_read_as_zero(gaps):
    for record in gaps["gaps"] + gaps["covered_skills"]:
        hours = record["industry_evidence"]["hours"]
        if hours is None:
            assert record["learning"]["recorded"] is False
            assert record["learning"]["hours"] is None
            assert "learning_hours_not_recorded" in _limitation_codes(record)
        else:
            assert record["learning"]["recorded"] is True
            assert record["learning"]["hours"] == hours


def test_demo_record_is_flagged_on_every_record(gaps):
    assert gaps["is_demo"] is True
    for record in (
        gaps["gaps"] + gaps["covered_skills"] + gaps["no_industry_record"]
    ):
        assert "curriculum_record_is_demo" in _limitation_codes(record)


def test_role_level_caveats_and_reproducibility_are_carried_through(gaps):
    assert gaps["industry"]["velocity_reproducibility"]["status"] == "pass"
    assert gaps["industry"]["evidence"], "Stage 7 proof records must be carried"
    for proof in gaps["industry"]["evidence"]:
        assert "caveats" in proof


# ------------------------------------------------- 6. duplicate course coverage
def test_skill_in_two_courses_is_covered_once_but_names_both(gaps):
    record = _by_skill(gaps["covered_skills"], "python")

    assert record["course_count"] == 2
    assert [course["course_id"] for course in record["curriculum_courses"]] == [
        "DEMO-102",
        "DEMO-201",
    ]
    assert "duplicate_course_coverage" in _limitation_codes(record)


def test_duplicate_coverage_is_not_counted_as_two_gaps(gaps):
    python_records = [
        record
        for record in gaps["gaps"] + gaps["covered_skills"]
        if record["skill"] == "python"
    ]
    assert len(python_records) == 1
    assert python_records[0]["coverage_status"] == COVERAGE_STATUS_COVERED


def test_duplicate_coverage_is_flagged_once_per_record(gaps):
    for record in gaps["covered_skills"]:
        codes = _limitation_codes(record)
        assert codes.count("duplicate_course_coverage") == (1 if record["course_count"] > 1 else 0)


# ------------------------------------------------- 7. role switching + unknown role
def test_switching_roles_changes_the_gap_set():
    data_science = build_role_curriculum_gaps("data_science")
    backend_ml = build_role_curriculum_gaps("backend_ml_engineer")

    assert {record["skill"] for record in data_science["gaps"]} != {
        record["skill"] for record in backend_ml["gaps"]
    }
    assert backend_ml["summary"]["industry_skill_count"] == 27
    assert data_science["summary"]["industry_skill_count"] == 45


def test_role_sensitivity_shows_up_as_no_industry_record():
    """Coverage of a named skill is a property of the curriculum, not the role.

    What changes with the role is which skills the industry records. So a skill the
    curriculum does teach is covered for a role that records it and has no industry
    record at all for a role that does not, and it is never a gap in either case.
    """
    backend_ml = build_role_curriculum_gaps("backend_ml_engineer")
    data_science = build_role_curriculum_gaps("data_science")

    ml_no_record = {record["skill"] for record in backend_ml["no_industry_record"]}
    ds_covered = {record["skill"] for record in data_science["covered_skills"]}
    assert "tensorflow" in ml_no_record
    assert "tensorflow" in ds_covered
    assert "tensorflow" not in {gap["skill"] for gap in backend_ml["gaps"]}


def test_corpus_only_role_is_answered_and_flagged():
    corpus_only = build_role_curriculum_gaps("other")
    assert corpus_only["industry"]["plannable"] is False
    assert corpus_only["summary"]["gap_count"] == 9
    assert "corpus_only_role" in _limitation_codes(corpus_only["gaps"][0])


def test_every_known_role_builds_without_error():
    for role in ROLES:
        payload = build_role_curriculum_gaps(role)
        assert payload["role_category"] == role
        assert payload["coverage_basis"] == COVERAGE_BASIS


def test_unknown_role_raises_with_the_roles_the_artifacts_record():
    with pytest.raises(UnknownTargetRoleError) as error:
        build_role_curriculum_gaps("embedded_systems_engineer")
    assert set(error.value.valid_roles) == set(ROLES)


def test_unknown_role_over_http_is_422_listing_valid_roles():
    response = client.get("/curriculum-gaps/embedded_systems_engineer")
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert set(detail["valid_roles"]) == set(ROLES)
    assert "embedded_systems_engineer" in detail["message"]


@pytest.mark.parametrize("role", ROLES)
def test_role_endpoint_serves_json(role):
    response = client.get(f"/curriculum-gaps/{role}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert body["role_category"] == role
    assert body["coverage_basis"] == COVERAGE_BASIS


# --------------------------------------------------------- 8. deterministic output
def test_repeated_builds_are_byte_identical():
    first = json.dumps(build_role_curriculum_gaps("data_science"), sort_keys=True)
    second = json.dumps(build_role_curriculum_gaps("data_science"), sort_keys=True)
    assert first == second


def test_repeated_requests_are_byte_identical():
    first = client.get("/curriculum-gaps/data_science").text
    second = client.get("/curriculum-gaps/data_science").text
    assert first == second


def test_gap_order_matches_the_order_stage_seven_publishes():
    gaps = build_role_curriculum_gaps("data_science")
    industry_order = [
        row["skill"] for row in build_role_curriculum_intelligence("data_science")["skills"]
    ]

    # Stage 8C adds no ordering of its own. Each partition is the Stage 7 sequence
    # filtered in place, so concatenating them would not be Stage 7's order but
    # both of them are subsequences of it.
    assert [record["skill"] for record in gaps["gaps"]] == [
        skill for skill in industry_order if skill in {g["skill"] for g in gaps["gaps"]}
    ]
    assert [record["skill"] for record in gaps["covered_skills"]] == [
        skill
        for skill in industry_order
        if skill in {c["skill"] for c in gaps["covered_skills"]}
    ]


def test_non_industry_groups_are_alphabetical():
    gaps = build_role_curriculum_gaps("backend_ml_engineer")
    assert [record["skill"] for record in gaps["no_industry_record"]] == sorted(
        record["skill"] for record in gaps["no_industry_record"]
    )
    assert [record["skill"] for record in gaps["unmatched_curriculum_skills"]] == sorted(
        record["skill"] for record in gaps["unmatched_curriculum_skills"]
    )


# ------------------------------------------------------ no invented analytics
def test_no_score_rank_or_percentage_is_invented():
    payload = build_role_curriculum_gaps("data_science")
    forbidden = {
        "score",
        "gap_score",
        "priority",
        "rank",
        "weight",
        "coverage_percentage",
        "growth_percentage",
        "gap_percentage",
        "recommendation",
        "semester",
        "placement",
    }

    def walk(node, path="body"):
        if isinstance(node, dict):
            for key, value in node.items():
                assert key.lower() not in forbidden, f"invented field {path}.{key}"
                walk(value, f"{path}.{key}")
        elif isinstance(node, list):
            for index, value in enumerate(node):
                walk(value, f"{path}[{index}]")

    walk(payload)


def test_summary_reports_counts_only():
    gaps = build_role_curriculum_gaps("data_science")
    summary = gaps["summary"]

    assert summary == {
        "industry_skill_count": 45,
        "covered_count": len(gaps["covered_skills"]),
        "gap_count": len(gaps["gaps"]),
        "no_industry_record_count": len(gaps["no_industry_record"]),
        "unmatched_curriculum_skill_count": len(gaps["unmatched_curriculum_skills"]),
    }
    assert summary["covered_count"] + summary["gap_count"] == summary["industry_skill_count"]


def test_stage_seven_fields_are_preserved_verbatim():
    gaps = build_role_curriculum_gaps("data_science")
    industry_rows = {
        row["skill"]: row
        for row in build_role_curriculum_intelligence("data_science")["skills"]
    }

    for record in gaps["gaps"] + gaps["covered_skills"]:
        expected = industry_rows[record["skill"]]
        for field in INDUSTRY_EVIDENCE_FIELDS:
            assert record["industry_evidence"][field] == expected[field], field


def test_not_available_declares_the_gaps_this_stage_does_not_close():
    gaps = build_role_curriculum_gaps("data_science")
    for field in (
        "coverage_percentage",
        "industry_growth_percentage",
        "gap_score",
        "gap_priority",
        "gap_rank",
        "semester_placement",
        "course_recommendation",
    ):
        assert field in gaps["not_available"]


def test_validation_is_carried_through_verbatim(gaps):
    record = load_curriculum_record()
    assert gaps["validation"] == json.loads(json.dumps(record["validation"]))
    # The demo record's real recorded defect is a dangling prerequisite, and it
    # survives rather than being dropped.
    assert gaps["validation"]["dangling_prerequisites"] == [
        {"course_id": "DEMO-205", "prerequisite_course_id": "DEMO-999"}
    ]


def _cyclic_document():
    """A two-course cycle, so cycle reporting is exercised on real input."""
    def course(course_id, prerequisites):
        return {
            "course_id": course_id,
            "name": course_id,
            "code": None,
            "credits": None,
            "hours": None,
            "description": None,
            "level": None,
            "delivery_format": None,
            "is_elective": None,
            "source": {"kind": "manual_entry"},
            "prerequisites": {"recorded": True, "course_ids": prerequisites},
            "skills": [],
        }

    return {
        "contract_version": CONTRACT_VERSION,
        "record_id": "cyclic_record",
        "record_kind": "demonstration",
        "is_demo": True,
        "is_representative": True,
        "label": "Cyclic record",
        "disclaimer": "Test only.",
        "source": {"kind": "demo"},
        "not_recorded": [],
        "programmes": [
            {
                "programme_id": "p",
                "name": "P",
                "institution_name": None,
                "award": None,
                "faculty": None,
                "duration_terms": None,
                "total_credits": None,
                "source": {"kind": "demo"},
                "curricula": [
                    {
                        "version_id": "v",
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
                                "semesters": [
                                    {
                                        "semester_id": "2026-2027-s1",
                                        "sequence": None,
                                        "term": None,
                                        "label": None,
                                        "start_date": None,
                                        "end_date": None,
                                        "recorded_credits": None,
                                        "source": {"kind": "demo"},
                                        "courses": [course("CYCLE-A", ["CYCLE-B"]), course("CYCLE-B", ["CYCLE-A"])],
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        ],
    }


def test_prerequisite_cycles_are_reported_not_repaired(tmp_path):
    # The loader reads a fixed file name, so the fixture replaces the demo file.
    (tmp_path / "demo_curriculum.json").write_text(
        json.dumps(_cyclic_document()), encoding="utf-8"
    )

    gaps = build_role_curriculum_gaps(
        "data_science", curriculum_directory=tmp_path
    )

    # The cycle is published as a path and nothing is reordered or dropped.
    assert gaps["validation"]["prerequisite_cycles"] == [
        ["CYCLE-A", "CYCLE-B", "CYCLE-A"]
    ]
    assert gaps["validation"]["cycle_course_ids"] == ["CYCLE-A", "CYCLE-B"]
    # Acting on the cycle is Stage 8D; this stage only reports it.
    assert gaps["stage_boundary"]["semester_placement"] == "stage_8d"


# ------------------------------------------------- 9. existing endpoint regression
def test_curriculum_intelligence_is_unchanged():
    response = client.get("/curriculum-intelligence/data_science")
    assert response.status_code == 200
    body = response.json()

    direct = build_role_curriculum_intelligence("data_science")
    assert body == json.loads(json.dumps(direct))


def test_curriculum_intelligence_unknown_role_is_still_422():
    response = client.get("/curriculum-intelligence/embedded_systems_engineer")
    assert response.status_code == 422
    assert set(response.json()["detail"]["valid_roles"]) == set(ROLES)


def test_curriculum_coverage_endpoint_is_unchanged():
    response = client.get("/curriculum-coverage/data_science")
    assert response.status_code == 200
    body = response.json()

    direct = build_curriculum_coverage("data_science")
    assert body == json.loads(json.dumps(direct))
    assert body["role_category"] == "data_science"


def test_coverage_and_gaps_agree_on_which_skills_are_covered():
    coverage = build_curriculum_coverage("data_science")
    gaps = build_role_curriculum_gaps("data_science")

    assert {row["skill"] for row in coverage["covered_skills"]} == {
        record["skill"] for record in gaps["covered_skills"]
    }
    assert {row["skill"] for row in coverage["not_covered_skills"]} == {
        record["skill"] for record in gaps["gaps"]
    }
    assert {
        entry["skill"] for entry in coverage["curriculum_skills_without_industry_record"]
    } == {record["skill"] for record in gaps["no_industry_record"]}


def test_curriculum_record_endpoint_is_unchanged():
    response = client.get("/curriculum-record")
    assert response.status_code == 200
    assert response.json()["record_id"] == "demo_curriculum_v1"


def test_earlier_endpoints_still_answer():
    assert client.get("/health").status_code == 200
    assert client.get("/velocity/statistical analysis").status_code == 200
    assert client.get("/proofs").status_code == 200
