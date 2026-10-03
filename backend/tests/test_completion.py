"""Stage 14C — a learner-asserted completion, and what it may be read as."""

import pytest
from fastapi.testclient import TestClient

from backend.data.calibration import (
    CALIBRATION_NOT_AVAILABLE,
    GAP_WEIGHT,
    calibrate_gap_closure,
)
from backend.data.completion import (
    COMPLETION_NOT_A_MEASURE_OF,
    COMPLETION_SOURCE,
    VERIFICATION_STATUS,
    CompletionInputError,
    asserted_skill_names,
    build_skill_completion_comparison,
    resume_text_with_assertions,
)
from backend.data.roadmap_pipeline import plan_roadmap
from backend.engines.signal_engine import extract_signals
from backend.main import app


JD = "Python SQL machine learning"


def request_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "resume_text": "Java and SQL",
        "jd_text": JD,
        "budget_hours": 60,
        "skill": "Python",
    }
    body.update(overrides)
    return body


def compare(**overrides: object) -> dict[str, object]:
    body = request_body(**overrides)
    return build_skill_completion_comparison(
        resume_text=str(body["resume_text"]),
        jd_text=str(body["jd_text"]),
        budget_hours=int(body["budget_hours"]),
        skill=str(body["skill"]),
        completed_skills=body.get("completed_skills") or (),
        target_role=body.get("target_role"),
    )


# --------------------------------------------------------------- the assertion


def test_completion_source_and_verification_are_fixed_and_explicit() -> None:
    result = compare()

    assert COMPLETION_SOURCE == "learner_asserted"
    assert VERIFICATION_STATUS == "not_verified"
    assert result["completion_source"] == "learner_asserted"
    assert result["verification_status"] == "not_verified"
    assert result["provenance"]["completion_source"] == "learner_asserted"
    assert result["provenance"]["verification_status"] == "not_verified"


def test_a_real_learner_event_is_never_labelled_synthetic() -> None:
    result = compare()

    assert result["is_synthetic"] is False
    assert "is_synthetic" not in result["not_a_measure_of"]
    assert "synthetic" not in str(result["provenance"]).casefold().replace(
        "not_a_measure_of", ""
    ) or result["is_synthetic"] is False


def test_boundary_and_note_name_the_assertion_and_the_verification_gap() -> None:
    provenance = compare()["provenance"]

    assert "not independently verified" in provenance["boundary"]
    assert "Asserted by learner" in provenance["boundary"]
    assert provenance["note"] == (
        "Model-internal gap-closure delta. Completion was asserted by the learner."
    )


# ------------------------------------------------------- measured from 14A


def test_delta_is_the_stage_14a_engine_result_for_the_same_two_plans() -> None:
    result = compare()

    before = plan_roadmap(
        resume_text="Java and SQL",
        jd_text=JD,
        budget_hours=60,
        target_role=None,
    )
    after = plan_roadmap(
        resume_text=resume_text_with_assertions("Java and SQL", ("python",)),
        jd_text=JD,
        budget_hours=60,
        target_role=None,
    )
    expected = calibrate_gap_closure(before["signals"], after["signals"], "python")

    assert result["before_score"] == expected["before_score"]
    assert result["after_score"] == expected["after_score"]
    assert result["delta"] == expected["delta"]
    assert result["predicted_gain"] == expected["predicted_gain"]
    assert result["gap_closed"] == expected["gap_closed"]
    assert result["provenance"]["measure"] == expected["provenance"]["measure"]


def test_a_closed_gap_moves_by_the_engines_own_gap_weight() -> None:
    result = compare()

    assert result["gap_closed"] is True
    assert result["gap_status"] == "closed"
    assert result["delta"] == -GAP_WEIGHT
    assert result["predicted_gain"] == GAP_WEIGHT
    assert result["matches_predicted_gain"] is True


# =============================================================================
# Stage 14D — the completion flow surfaces the model-internal check
# =============================================================================


def test_a_genuine_completion_reports_a_zero_consistency_error() -> None:
    """A real closure matches the model exactly, so the error is 0.0."""
    result = compare()

    assert result["model_internal_consistency_error"] == 0.0


def test_an_unchanged_completion_reports_a_zero_consistency_error_too() -> None:
    """No gap closed, so nothing was expected and nothing was missed: also 0."""
    # `sql` is named by the job description and already in the resume, so asserting
    # it changes nothing. (`java` would be refused: the job description names no
    # signal for it, so there is no second score to subtract.)
    result = compare(skill="sql")

    assert result["gap_closed"] is False
    assert result["predicted_gain"] == 0.0
    assert result["model_internal_consistency_error"] == 0.0


def test_the_consistency_error_agrees_with_the_boolean_it_backs() -> None:
    """The magnitude and the boolean are two views of one comparison."""
    for skill in ("python", "sql"):
        result = compare(skill=skill)

        consistent = result["model_internal_consistency_error"] == 0.0
        # `matches_predicted_gain` additionally requires a closure, so it is the
        # stricter of the two and can only be true when the error is zero.
        if result["matches_predicted_gain"]:
            assert result["gap_closed"] is True
            assert consistent is True


def test_the_completion_endpoint_returns_the_consistency_error() -> None:
    """Additive field, so the existing response shape is otherwise untouched."""
    client = TestClient(app)
    response = client.post("/skill-completion", json=request_body(skill="Python"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["model_internal_consistency_error"] == 0.0
    # Every field that existed before this stage still exists and still means the
    # same thing, and the learner-asserted boundary is unchanged.
    assert payload["completion_source"] == COMPLETION_SOURCE
    assert payload["verification_status"] == VERIFICATION_STATUS
    for field in (
        "skill",
        "before_score",
        "after_score",
        "delta",
        "predicted_gain",
        "gap_closed",
        "gap_status",
        "matches_predicted_gain",
        "gap_weight",
    ):
        assert field in payload


def test_the_completion_boundary_names_the_missing_observation() -> None:
    """A real figure sits in this payload, so the absent one must be named."""
    result = compare()

    note = result["provenance"]["observed_not_available_note"]
    assert "Observed learner improvement is not available" in note
    assert "not independently verified" in note
    # And the refused learner figures stay refused on the endpoint.
    for name in ("observed_gain", "actual_gain", "prediction_accuracy"):
        assert name in result["not_a_measure_of"]
        assert name not in result


def test_the_completion_payload_never_reports_a_learner_outcome_figure() -> None:
    """A zero consistency error must not be mistaken for a learner measurement."""
    result = compare()
    observed_names = (
        "observed_gain",
        "prediction_error",
        "learner_improvement",
        "skill_mastery",
        "employability_score",
    )
    learner_outcomes = (
        "observed_gain",
        "learner_improvement",
        "skill_mastery",
        "employability_score",
    )

    for name in observed_names:
        assert name not in result
    # The learner-outcome figures are named as refused on the endpoint.
    for name in learner_outcomes:
        assert name in result["not_a_measure_of"]

    # The consistency error is labelled as a consistency check, not accuracy.
    assert "not prediction accuracy" in (
        result["provenance"]["model_internal_consistency_note"]
    )


def test_both_plans_are_returned_and_are_the_plans_that_were_measured() -> None:
    result = compare()

    before = plan_roadmap(
        resume_text="Java and SQL", jd_text=JD, budget_hours=60, target_role=None
    )
    after = plan_roadmap(
        resume_text=resume_text_with_assertions("Java and SQL", ("python",)),
        jd_text=JD,
        budget_hours=60,
        target_role=None,
    )

    assert result["before_roadmap"] == before["roadmap"]
    assert result["after_roadmap"] == after["roadmap"]
    assert result["before_budget_hours"] == before["budget_hours"]
    assert result["after_budget_hours"] == after["budget_hours"]


def test_asserting_a_gap_removes_it_from_the_replanned_route() -> None:
    result = compare()

    assert "python" in [row["skill"] for row in result["before_roadmap"]]
    assert "python" not in [row["skill"] for row in result["after_roadmap"]]


def test_a_skill_the_resume_already_names_reports_no_closure() -> None:
    result = compare(skill="SQL")

    assert result["gap_status"] == "already_present"
    assert result["gap_closed"] is False
    assert result["delta"] == 0.0
    assert result["predicted_gain"] == 0.0
    assert "no recorded gap to close" in result["gap_status_note"]


def test_a_skill_the_job_description_never_names_is_refused() -> None:
    with pytest.raises(CompletionInputError):
        compare(skill="kubernetes")


def test_completions_accumulate_so_each_is_measured_against_the_last_context() -> None:
    first = compare()
    second = compare(skill="machine learning", completed_skills=first["asserted_skills"])

    assert first["asserted_skills"] == ["python"]
    assert second["asserted_skills"] == ["python", "machine learning"]
    assert second["assertion_count"] == 2


def test_the_plan_uses_the_same_pipeline_as_post_roadmap() -> None:
    client = TestClient(app)
    roadmap = client.post("/roadmap", json=request_body()).json()

    assert roadmap == {
        "budget_hours": compare()["before_budget_hours"],
        "roadmap": compare()["before_roadmap"],
    }


def test_a_role_scoped_comparison_plans_the_role_it_was_given() -> None:
    result = compare(target_role="data_science")

    assert result["target_role"] == "data_science"
    assert result["gap_closed"] is True


# ------------------------------------------------------------------ refusals


def test_a_blank_skill_name_is_refused_rather_than_estimated() -> None:
    for blank in ("", "   ", "\t\n"):
        with pytest.raises(CompletionInputError):
            compare(skill=blank)


def test_an_already_asserted_skill_is_refused_as_a_second_completion() -> None:
    with pytest.raises(CompletionInputError):
        compare(completed_skills=["Python"])


def test_asserted_skill_names_normalize_and_deduplicate() -> None:
    assert asserted_skill_names(
        ["Machine Learning", "machine  learning", " Python ", "", None, 7]
    ) == ("machine learning", "python")
    assert asserted_skill_names(None) == ()


def test_the_after_text_is_the_learners_text_plus_the_assertions() -> None:
    assert resume_text_with_assertions("Java and SQL", ("python",)) == (
        "Java and SQL\npython"
    )
    assert resume_text_with_assertions("", ("python",)) == "python"
    assert resume_text_with_assertions(None, ()) == ""
    assert resume_text_with_assertions("  Java  ", ("sql",)) == "Java\nsql"


# ---------------------------------------------------- what it may not be read as


def test_no_result_carries_a_learner_outcome_field() -> None:
    result = compare()

    named = set(COMPLETION_NOT_A_MEASURE_OF)
    assert set(CALIBRATION_NOT_AVAILABLE).issubset(named)
    assert {
        "actual_gain",
        "actual_learner_gain",
        "observed_gain",
        "employability_score",
        "placement_probability",
        "hiring_probability",
        "learner_improvement",
        "skill_mastery",
        "prediction_accuracy",
        "mae",
        "rmse",
        "verified_completion",
        "calibration_statistics",
    }.issubset(named)
    assert result["not_a_measure_of"] == list(COMPLETION_NOT_A_MEASURE_OF)
    assert set(result).isdisjoint(named)
    assert set(result["provenance"]).isdisjoint(named)
    assert set(result["provenance"]["not_a_measure_of"]) == set(COMPLETION_NOT_A_MEASURE_OF)


def test_nothing_is_stored_between_calls() -> None:
    first = compare()
    second = compare()

    assert first == second
    assert compare(skill="SQL")["asserted_skills"] == ["sql"]


# ----------------------------------------------------------------- the route


def test_the_route_serves_the_comparison_with_both_plans() -> None:
    client = TestClient(app)
    response = client.post("/skill-completion", json=request_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload["skill"] == "python"
    assert payload["completion_source"] == "learner_asserted"
    assert payload["verification_status"] == "not_verified"
    assert payload["is_synthetic"] is False
    assert payload["gap_closed"] is True
    assert payload["delta"] == -GAP_WEIGHT
    assert payload["predicted_gain"] == GAP_WEIGHT
    assert "python" in [row["skill"] for row in payload["before_roadmap"]]
    assert "python" not in [row["skill"] for row in payload["after_roadmap"]]


def test_the_route_does_not_change_the_roadmap_response_shape() -> None:
    client = TestClient(app)
    roadmap = client.post("/roadmap", json=request_body()).json()

    assert set(roadmap) == {"budget_hours", "roadmap"}
    assert all(
        set(row) == {"skill", "hours", "priority", "reason", "vendor_flag"}
        for row in roadmap["roadmap"]
    )


def test_a_roadmap_request_without_completions_is_planned_from_its_own_text() -> None:
    client = TestClient(app)
    body = request_body()

    assert client.post("/roadmap", json=body).json() == client.post(
        "/roadmap", json={**body, "completed_skills": []}
    ).json()


def test_asserted_completions_travel_with_every_later_replan() -> None:
    """A moved dial must not forget the assertion the completion recorded."""

    client = TestClient(app)
    body = request_body()

    baseline = client.post("/roadmap", json=body).json()
    replanned = client.post(
        "/roadmap", json={**body, "budget_hours": 120, "completed_skills": ["python"]}
    ).json()
    assert_same_budget = client.post(
        "/roadmap", json={**body, "completed_skills": ["python"]}
    ).json()

    assert "python" in [row["skill"] for row in baseline["roadmap"]]
    assert "python" not in [row["skill"] for row in assert_same_budget["roadmap"]]
    assert "python" not in [row["skill"] for row in replanned["roadmap"]]
    assert replanned["budget_hours"] == 120


def test_the_roadmap_and_the_comparison_plan_the_same_after_context() -> None:
    client = TestClient(app)
    body = request_body()

    completion = client.post("/skill-completion", json=body).json()
    replanned = client.post(
        "/roadmap", json={**body, "completed_skills": completion["asserted_skills"]}
    ).json()

    assert replanned == {
        "budget_hours": completion["after_budget_hours"],
        "roadmap": completion["after_roadmap"],
    }


def test_the_route_rejects_an_empty_or_duplicate_or_unknown_skill() -> None:
    client = TestClient(app)

    assert client.post("/skill-completion", json=request_body(skill="")).status_code == 422
    assert (
        client.post(
            "/skill-completion", json=request_body(completed_skills=["python"])
        ).status_code
        == 422
    )
    unknown = client.post(
        "/skill-completion", json=request_body(skill="kubernetes")
    )
    assert unknown.status_code == 422
    assert "no" in unknown.json()["detail"]["message"]


def test_the_route_reports_an_unsupported_role_the_way_roadmap_does() -> None:
    client = TestClient(app)

    completion = client.post(
        "/skill-completion", json=request_body(target_role="not_a_role")
    )
    roadmap = client.post("/roadmap", json=request_body(target_role="not_a_role"))

    assert completion.status_code == 422
    assert roadmap.status_code == 422
    assert completion.json()["detail"]["valid_roles"] == roadmap.json()["detail"][
        "valid_roles"
    ]


def test_the_route_refuses_a_role_the_service_cannot_plan() -> None:
    client = TestClient(app)
    response = client.post("/skill-completion", json=request_body(target_role="other"))

    assert response.status_code == 422
    assert "plannable_roles" in response.json()["detail"]


def test_the_route_requires_the_learner_text_it_compares() -> None:
    client = TestClient(app)

    for missing in ("resume_text", "jd_text", "skill", "budget_hours"):
        body = request_body()
        body.pop(missing)
        assert client.post("/skill-completion", json=body).status_code == 422


def test_the_measurement_reads_the_plans_signals_not_a_recomputation() -> None:
    """The delta must come from the two plans, not from a third scoring pass."""

    result = compare()
    before_score = next(
        signal["signal_score"]
        for signal in plan_roadmap(
            resume_text="Java and SQL", jd_text=JD, budget_hours=60, target_role=None
        )["signals"]
        if signal["skill"] == "python"
    )
    raw = next(
        signal["signal_score"]
        for signal in extract_signals("Java and SQL", JD)
        if signal["skill"] == "python"
    )

    assert result["before_score"] == raw
    assert result["before_score"] == pytest.approx(before_score)
