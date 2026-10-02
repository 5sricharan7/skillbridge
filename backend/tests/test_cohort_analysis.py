"""Stage 13 — cohort coverage against the recorded market baseline, and what it refuses.

Two kinds of assertion live here.

The **prepared-baseline** assertions compare back to the finalized artifacts and to
``build_role_curriculum_intelligence`` itself rather than to hand-written constants,
so a fabricated frequency or a second matching rule fails instead of passing. The
baseline assertions also pin the reuse: the numbers a cohort is compared against
must be the same numbers ``GET /curriculum-intelligence/{role}`` serves, or the
comparison would drift from the baseline a client already reads.

The **refusal** assertions cover the things that must never happen: a duplicate
record counted twice, a skill the baseline does not record given a market figure of
zero, a zero-student cohort reported as a full shortfall, the live freshness sample
leaking into a prepared comparison, or a figure this repository cannot support
being returned under a plausible name.
"""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from backend.data.adapters import normalize_skill
from backend.data.cohort_analysis import (
    COHORT_NOT_AVAILABLE,
    CohortInputError,
    build_cohort_analysis,
)
from backend.data.curriculum_intelligence import build_role_curriculum_intelligence
from backend.data.loaders import load_skill_scores
from backend.main import app


client = TestClient(app)

ROLE = "data_science"


def recorded_baseline() -> dict[str, dict[str, object]]:
    """The role's recorded skills, keyed by normalized name, read from the artifact."""
    return {
        normalize_skill(str(row["skill"])): row
        for row in load_skill_scores()
        if row["role_category"] == ROLE
    }


def analyze(cohort, role=ROLE):
    response = client.post("/cohort-analysis", json={"cohort": cohort, "target_role": role})
    assert response.status_code == 200, response.text
    return response.json()


def rows_by_skill(payload):
    return {row["skill"]: row for row in payload["skills"]}


def student(student_id, *skills):
    return {"student_id": student_id, "skills": list(skills)}


def test_gap_is_the_recorded_market_share_minus_cohort_coverage():
    baseline = recorded_baseline()
    skill = next(
        name
        for name, row in sorted(baseline.items())
        if row["frequency"] is not None
    )
    frequency = baseline[skill]["frequency"]

    payload = analyze([student("S1", skill), student("S2"), student("S3")])
    row = rows_by_skill(payload)[skill]

    assert row["in_market_baseline"] is True
    assert row["students_listing"] == 1
    assert row["cohort_size"] == 3
    assert row["student_proficiency"] == pytest.approx(1 / 3, abs=1e-4)
    assert row["market_demand"] == pytest.approx(frequency, abs=1e-4)
    assert row["gap"] == pytest.approx(frequency - row["student_proficiency"], abs=1e-4)
    assert row["market_classification"] == baseline[skill]["classification"]


def test_market_demand_is_the_same_number_the_role_endpoint_serves():
    intelligence = build_role_curriculum_intelligence(ROLE)
    expected = {
        normalize_skill(str(row["skill"])): row["frequency"]
        for row in intelligence["skills"]
    }

    payload = analyze([student("S1", "python"), student("S2")])

    for row in payload["skills"]:
        if not row["in_market_baseline"]:
            continue
        assert row["market_demand"] == pytest.approx(
            float(expected[row["skill"]]), abs=1e-4
        )


def test_baseline_block_reports_the_prepared_layer_and_its_corpus():
    intelligence = build_role_curriculum_intelligence(ROLE)

    block = analyze([student("S1", "python")])["market_baseline"]

    assert block["role"] == ROLE
    assert block["layer"] == "prepared static baseline"
    assert block["skill_count"] == len(intelligence["skills"])
    assert block["postings"] == intelligence["corpus"]["role_postings"]
    assert block["corpus"]["dataset_rows"] == intelligence["corpus"]["dataset_rows"]
    assert block["corpus"]["date_min"] == intelligence["corpus"]["date_min"]
    assert block["corpus"]["date_max"] == intelligence["corpus"]["date_max"]


def test_a_baseline_skill_nobody_records_is_a_full_gap_not_a_missing_row():
    baseline = recorded_baseline()
    unrecorded = next(
        name
        for name, row in sorted(baseline.items())
        if row["frequency"] is not None
    )

    payload = analyze([student("S1", "python")])
    row = rows_by_skill(payload)[unrecorded]

    assert row["students_listing"] == 0
    assert row["student_proficiency"] == 0.0
    assert row["gap"] == pytest.approx(baseline[unrecorded]["frequency"], abs=1e-4)
    assert unrecorded not in payload["skills_not_in_market_baseline"]


def test_a_skill_the_baseline_does_not_record_has_no_market_figure():
    baseline = recorded_baseline()
    outsider = "handmade-foghorn"

    payload = analyze([student("S1", outsider, "python"), student("S2", outsider)])
    row = rows_by_skill(payload)[outsider]

    assert row["in_market_baseline"] is False
    assert row["students_listing"] == 2
    assert row["student_proficiency"] == 1.0
    assert row["market_demand"] is None
    assert row["gap"] is None, "no recorded market figure means no gap, never a zero gap"
    assert row["market_classification"] is None
    assert payload["skills_not_in_market_baseline"] == [outsider]
    assert outsider not in baseline


def test_coverage_is_a_share_of_students_holding_the_skill():
    payload = analyze(
        [
            student("S1", "python", "sql"),
            student("S2", "python"),
            student("S3", "python", "sql"),
            student("S4"),
        ]
    )
    rows = rows_by_skill(payload)

    assert rows["python"]["students_listing"] == 3
    assert rows["python"]["student_proficiency"] == 0.75
    assert rows["sql"]["students_listing"] == 2
    assert rows["sql"]["student_proficiency"] == 0.5
    assert rows["python"]["students"] == ["S1", "S2", "S3"]
    assert payload["cohort_size"] == 4
    assert payload["students_with_skills"] == 3


def test_a_repeat_inside_one_student_is_one_record_not_two_students():
    payload = analyze(
        [
            student("S1", "SQL", "sql ", "  sql", "sql"),
            student("S2", "sql"),
        ]
    )
    row = rows_by_skill(payload)["sql"]

    assert row["students_listing"] == 2, "one student holding sql twice is one student"
    assert row["student_proficiency"] == 1.0
    assert payload["skill_records_submitted"] == 5
    assert payload["skill_records_deduplicated"] == 3


def test_case_and_whitespace_variants_fold_into_one_skill():
    payload = analyze(
        [
            student("S1", "  Machine   Learning "),
            student("S2", "machine learning"),
            student("S3", "MACHINE\tLEARNING"),
        ]
    )

    assert "machine learning" in rows_by_skill(payload)
    assert rows_by_skill(payload)["machine learning"]["students_listing"] == 3


def test_a_blank_skill_entry_is_reported_rather_than_counted():
    payload = analyze([student("S1", "python", "   ", ""), student("S2", "python")])

    assert payload["skill_records_submitted"] == 4
    assert payload["skill_records_deduplicated"] == 2
    assert payload["distinct_cohort_skills"] == 1
    assert "" not in rows_by_skill(payload)


def test_rows_cover_the_union_of_cohort_and_baseline_skills():
    baseline = recorded_baseline()
    outsider = "handmade-foghorn"

    payload = analyze([student("S1", outsider)])

    assert {row["skill"] for row in payload["skills"]} == set(baseline) | {outsider}
    assert len(payload["skills"]) == len(baseline) + 1


def test_rows_are_ordered_by_gap_then_name_with_unrecorded_skills_last():
    payload = analyze([student("S1", "python", "handmade-foghorn"), student("S2")])
    rows = payload["skills"]

    gapped = [row["gap"] for row in rows if row["gap"] is not None]
    assert gapped == sorted(gapped, reverse=True), "widest gap first"

    baseline_rows = [row for row in rows if row["in_market_baseline"]]
    outsider_rows = [row for row in rows if not row["in_market_baseline"]]
    assert rows[: len(baseline_rows)] == baseline_rows, "recorded skills before the rest"

    tied = [row["skill"] for row in baseline_rows if row["gap"] == gapped[-1]]
    assert tied == sorted(tied), "equal gaps fall back to alphabetical order"
    assert outsider_rows == sorted(outsider_rows, key=lambda row: row["skill"])


def test_the_same_cohort_and_role_always_produce_the_same_response():
    cohort = [student("S1", "python", "sql"), student("S2", "react"), student("S3")]

    assert analyze(cohort) == analyze(cohort)


def test_the_live_sample_never_reaches_a_prepared_comparison():
    payload = analyze([student("S1", "python")])

    assert "live" not in payload
    assert "fresh_signals" not in payload
    assert "live_data_last_updated" not in payload
    for row in payload["skills"]:
        assert "live" not in row
        assert "fresh_signals" not in row


def test_unsupported_figures_are_named_rather_than_returned():
    payload = analyze([student("S1", "python")])

    assert payload["not_available"] == list(COHORT_NOT_AVAILABLE)
    for name in COHORT_NOT_AVAILABLE:
        assert name not in payload, f"{name} is refused, so it must not be a field"
        for row in payload["skills"]:
            assert name not in row


def test_the_method_note_defines_coverage_as_coverage():
    note = analyze([student("S1", "python")])["method_note"]

    assert "not an assessed level" in note
    assert "market_demand minus student_proficiency" in note


def test_a_cohort_with_no_students_is_refused():
    response = client.post("/cohort-analysis", json={"cohort": [], "target_role": ROLE})

    assert response.status_code == 422
    assert "at least one student" in response.json()["detail"]["message"]


def test_a_student_with_no_skills_still_counts_in_the_cohort():
    payload = analyze([student("S1", "python"), student("S2"), student("S3")])

    assert payload["cohort_size"] == 3
    assert payload["students_with_skills"] == 1
    assert rows_by_skill(payload)["python"]["student_proficiency"] == pytest.approx(
        1 / 3, abs=1e-4
    )


@pytest.mark.parametrize(
    ("cohort", "fragment"),
    [
        ([student("   ", "python")], "cannot be blank"),
        ([student("S1", "python"), student("S1", "sql")], "already used"),
    ],
)
def test_an_unusable_student_record_names_the_row(cohort, fragment):
    response = client.post("/cohort-analysis", json={"cohort": cohort, "target_role": ROLE})

    assert response.status_code == 422
    assert fragment in response.json()["detail"]["message"]
    assert "cohort[" in response.json()["detail"]["message"]


@pytest.mark.parametrize(
    "cohort",
    [
        [{"student_id": "S1", "skills": "python"}],
        [{"student_id": "S1", "skills": ["python", 7]}],
        [{"student_id": "S1", "skills": None}],
    ],
)
def test_a_malformed_skill_list_is_refused(cohort):
    response = client.post("/cohort-analysis", json={"cohort": cohort, "target_role": ROLE})

    assert response.status_code == 422


@pytest.mark.parametrize(
    "cohort",
    [
        [{"skills": ["python"]}],
        [{"student_id": "", "skills": ["python"]}],
        [{"student_id": 5, "skills": []}],
        ["S1"],
    ],
)
def test_a_malformed_student_record_is_refused(cohort):
    response = client.post("/cohort-analysis", json={"cohort": cohort, "target_role": ROLE})

    assert response.status_code == 422


def test_the_builder_refuses_a_malformed_record_that_never_reaches_pydantic():
    """A direct caller bypasses validation, so the builder checks the same ground."""
    cohort = [SimpleNamespace(student_id="S1", skills=["python", 7])]

    with pytest.raises(CohortInputError) as error:
        build_cohort_analysis(cohort, target_role=ROLE)

    assert "cohort[0].skills[1]" in str(error.value)


def test_the_builder_refuses_a_mapping_cohort_without_pydantic():
    cohort = [{"student_id": "S1", "skills": ["Python", "python"]}]

    payload = build_cohort_analysis(cohort, target_role=ROLE)

    assert rows_by_skill(payload)["python"]["students_listing"] == 1


@pytest.mark.parametrize(
    "role", ["Embedded Systems Engineer", "astronaut", "", "Data Science"]
)
def test_an_unplannable_or_unknown_role_is_refused_the_way_roadmap_refuses_it(role):
    response = client.post(
        "/cohort-analysis", json={"cohort": [student("S1", "python")], "target_role": role}
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, dict)
    assert "message" in detail


def test_the_role_is_casefolded_and_whitespace_trimmed_before_it_is_echoed():
    payload = analyze([student("S1", "python")], role="  DATA_SCIENCE  ")

    assert payload["target_role"] == ROLE
    assert payload["market_baseline"]["role"] == ROLE


def test_target_role_is_required():
    response = client.post("/cohort-analysis", json={"cohort": [student("S1")]})

    assert response.status_code == 422


def test_the_response_carries_no_stored_student_record():
    payload = analyze([student("S1", "python"), student("S2", "sql")])

    assert set(payload) == {
        "cohort_size",
        "students_with_skills",
        "skill_records_submitted",
        "skill_records_deduplicated",
        "distinct_cohort_skills",
        "target_role",
        "market_baseline",
        "skills",
        "skills_not_in_market_baseline",
        "not_available",
        "method_note",
    }
    assert set(payload["skills"][0]) == {
        "skill",
        "students_listing",
        "cohort_size",
        "student_proficiency",
        "market_demand",
        "gap",
        "in_market_baseline",
        "market_classification",
        "students",
    }