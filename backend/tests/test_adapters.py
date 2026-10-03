import json

import pytest

from backend.data import adapters
from backend.data.adapters import (
    ArtifactGraphCycleError,
    UnplannableTargetRoleError,
    UnknownTargetRoleError,
    adapt_signals_for_role,
    build_skill_vocabulary,
    build_velocity_profile,
    find_dag_cycles,
    normalize_skill,
    plannable_roles,
    resolve_skill_name,
    token_signature,
    validate_target_role,
)
from backend.data.loaders import load_cleaned_postings
from backend.data.roadmap_pipeline import enrich_signals_with_velocity
from backend.engines.optimizer import build_learning_graph
from backend.engines.optimizer import optimize_roadmap
from backend.engines.skill_catalog import SKILL_CATALOG
from backend.engines.signal_engine import extract_signals
from backend.main import app
from fastapi.testclient import TestClient


def signal(skill: str, **extra: object) -> dict[str, object]:
    return {
        "skill": skill,
        "jd_frequency": 2,
        "gap": True,
        "signal_score": 0.64,
        "priority": "important",
        "trend": "rising",
        **extra,
    }


def test_normalization_casefolds_and_collapses_whitespace_without_punctuation_loss() -> None:
    assert normalize_skill("  NODE.Js \t REST   API  ") == "node.js rest api"
    assert [normalize_skill(skill) for skill in ("C#", "C++", "CI/CD", "node.js", "REST API", "Spring Boot")] == [
        "c#",
        "c++",
        "ci/cd",
        "node.js",
        "rest api",
        "spring boot",
    ]


def test_exact_skill_match_takes_precedence() -> None:
    match = resolve_skill_name("  Node.Js ", ["node.js", "node js"])

    assert match.canonical_skill == "node.js"
    assert match.match_type == "exact"
    assert match.evidence is None


def test_only_documented_statistical_analysis_alias_is_applied() -> None:
    match = resolve_skill_name("Statistical   Analysis", ["statistics"])

    assert match.canonical_skill == "statistics"
    assert match.match_type == "explicit_alias"
    assert "Stage 3" in match.evidence


def test_token_signature_is_assertion_only_and_does_not_merge() -> None:
    assert token_signature("node.js") == token_signature("node js")

    match = resolve_skill_name("node.js", ["node js"])

    assert match.match_type == "unmatched"
    assert match.canonical_skill == "node.js"
    assert match.token_signature_candidates == ("node js",)


@pytest.mark.parametrize(
    ("incoming", "known"),
    [
        ("database", ["databases"]),
        ("aws", ["aws sagemaker"]),
        ("statistical modeling", ["statistics", "statistical analysis"]),
    ],
)
def test_unapproved_names_remain_distinct(incoming: str, known: list[str]) -> None:
    match = resolve_skill_name(incoming, known)

    assert match.canonical_skill == normalize_skill(incoming)
    assert match.match_type == "unmatched"


def test_artifact_and_catalog_vocabularies_are_both_preserved() -> None:
    vocabulary = build_skill_vocabulary()

    assert "pandas" in vocabulary["artifact_only_skills"]
    assert "rust" in vocabulary["catalog_only_skills"]
    assert set(vocabulary["artifact_skills"]) <= set(vocabulary["skills"])
    assert set(vocabulary["catalog_skills"]) <= set(vocabulary["skills"])


def test_plannable_roles_are_derived_from_artifact_intersection() -> None:
    assert plannable_roles() == ["backend_ml_engineer", "data_science"]
    assert validate_target_role(" DATA_SCIENCE ") == "data_science"
    assert validate_target_role("backend_ml_engineer") == "backend_ml_engineer"


def test_other_is_known_but_not_plannable() -> None:
    with pytest.raises(UnplannableTargetRoleError) as error:
        validate_target_role("other")

    assert error.value.role == "other"
    assert error.value.plannable_roles == ("backend_ml_engineer", "data_science")


def test_unknown_role_lists_artifact_roles() -> None:
    with pytest.raises(UnknownTargetRoleError) as error:
        validate_target_role("invented_role")

    assert error.value.valid_roles == (
        "backend_ml_engineer",
        "data_science",
        "other",
    )


def test_caller_hours_override_engine_artifact_and_default_hours() -> None:
    result = adapt_signals_for_role(
        [signal("python"), signal("pandas"), signal("not in artifacts")],
        "data_science",
        caller_hours={"python": 3},
    )
    by_skill = {row["skill"]: row for row in result.signals}

    assert by_skill["python"]["estimated_hours"] == 3
    assert by_skill["python"]["hours_source"] == "caller"
    assert by_skill["pandas"]["hours_source"] == "artifact"
    assert by_skill["not in artifacts"]["hours_source"] == "default"


def test_existing_learning_hours_take_precedence_over_artifact_hours() -> None:
    result = adapt_signals_for_role([signal("sql")], "data_science")
    sql = result.signals[0]

    assert sql["estimated_hours"] == 8
    assert sql["hours_source"] == "learning_hours"
    conflicts = result.divergence_report["hours_conflicts"]
    sql_conflict = next(row for row in conflicts if row["skill"] == "sql")
    assert sql_conflict["learning_hours"] == 8
    assert sql_conflict["artifact_hours"] == 10


def test_signal_hours_are_treated_as_caller_supplied() -> None:
    result = adapt_signals_for_role(
        [signal("python", estimated_hours=5)], "data_science"
    )

    assert result.signals[0]["estimated_hours"] == 5
    assert result.signals[0]["hours_source"] == "caller"


def test_artifact_only_skill_gets_role_hours_and_artifact_metadata() -> None:
    result = adapt_signals_for_role([signal("pandas")], "data_science")
    pandas = result.signals[0]

    assert pandas["hours_source"] == "artifact"
    assert pandas["estimated_hours"] > 0
    assert pandas["prior_frequency"] > 0
    assert pandas["classification"]
    assert "pandas" in result.divergence_report["artifact_only_skills"]


def test_role_adapter_does_not_change_signal_scoring_or_priority() -> None:
    original = signal("python")
    result = adapt_signals_for_role([original], "data_science")
    adapted = result.signals[0]

    for key in ("signal_score", "priority", "gap", "jd_frequency"):
        assert adapted[key] == original[key]
    assert adapted["prior_frequency"] != adapted["jd_frequency"]


def test_artifact_prerequisites_are_resolved_without_fabricating_dangling_nodes() -> None:
    result = adapt_signals_for_role(
        [signal("machine learning")], "data_science"
    )
    by_skill = {row["skill"]: row for row in result.signals}

    assert by_skill["machine learning"]["prerequisites"] == ["python", "statistics"]
    assert "python" not in {row["skill"] for row in result.signals}
    assert result.divergence_report["dag_dangling_edges"] == []
    backend = adapt_signals_for_role([signal("django")], "backend_ml_engineer")
    assert backend.signals[0]["prerequisites"] == []
    assert [row["skill"] for row in backend.signals] == ["django"]
    assert backend.divergence_report["dag_dangling_edges"] == [
        {
            "role_category": "backend_ml_engineer",
            "skill": "django",
            "prerequisite": "python",
        }
    ]
    assert backend.divergence_report["artifact_dag"]["django"] == ["python"]


def test_artifact_prerequisites_are_additive_to_existing_react_requirement() -> None:
    result = adapt_signals_for_role([signal("react")], "backend_ml_engineer")
    assert result.signals[0]["prerequisites"] == []
    assert build_learning_graph(result.signals)["react"] == ["javascript"]

    conflict = next(
        row
        for row in result.divergence_report["dag_conflicts"]
        if row["skill"] == "react"
    )
    assert conflict["engine_prerequisites"] == ["javascript"]
    assert conflict["artifact_prerequisites"] == []


def test_known_data_science_dag_conflicts_are_reported() -> None:
    result = adapt_signals_for_role([], "data_science")
    conflicts = {
        row["skill"]: row for row in result.divergence_report["dag_conflicts"]
    }

    assert {"machine learning", "deep learning"} <= set(conflicts)


def test_role_prior_is_not_substituted_for_job_description_signal() -> None:
    original = signal("python", jd_frequency=1, signal_score=0.52)
    result = adapt_signals_for_role([original], "data_science")
    adapted = result.signals[0]

    assert adapted["prior_frequency"] != adapted["jd_frequency"]
    assert adapted["signal_score"] == 0.52
    assert adapted["priority"] == "important"


def test_explicit_alias_carries_its_evidence_into_internal_metadata() -> None:
    result = adapt_signals_for_role([signal("statistical analysis")], "data_science")
    resolution = result.signals[0]["skill_resolution"]

    assert resolution["canonical_skill"] == "statistics"
    assert resolution["match_type"] == "explicit_alias"
    assert resolution["evidence"]


def test_artifact_dags_are_acyclic_for_each_plannable_role() -> None:
    data_science = adapt_signals_for_role([], "data_science")
    backend = adapt_signals_for_role([], "backend_ml_engineer")

    assert data_science.divergence_report["dag_cycles"] == []
    assert backend.divergence_report["dag_cycles"] == []
    assert find_dag_cycles({"a": ["b"], "b": []}) == []


def test_cycle_detection_surfaces_cycle_instead_of_dropping_an_edge(monkeypatch) -> None:
    original_loader = adapters.loaders.load_dag_structure

    def cyclic_dag(*, directory=None):
        dag = original_loader(directory=directory)
        dag["data_science"]["python"] = ["pandas"]
        return dag

    monkeypatch.setattr(adapters.loaders, "load_dag_structure", cyclic_dag)

    with pytest.raises(ArtifactGraphCycleError) as error:
        adapt_signals_for_role([signal("python")], "data_science")

    assert error.value.cycles
    assert "cyclic" in str(error.value)


def test_velocity_history_uses_only_the_four_specified_slices() -> None:
    first = build_velocity_profile()
    second = build_velocity_profile()

    assert first == second
    assert first["status"] == "pass"
    assert first["checked_scores"] == 75
    assert first["matched_scores"] == 75
    assert first["tolerance"] == adapters.VELOCITY_REPRODUCIBILITY_TOLERANCE
    assert {
        row["time_slice"] for row in first["history"]
    } == set(adapters.TIME_SLICES)


def test_velocity_counts_and_frequencies_match_posting_artifact() -> None:
    profile = build_velocity_profile()
    postings = [
        posting
        for posting in load_cleaned_postings()
        if posting["role_category"] == "data_science"
        and posting["posted_date"].year == 2025
        and posting["posted_date"].month <= 6
    ]
    python_mentions = sum("python" in posting["skills"] for posting in postings)
    python_slice = next(
        row
        for row in profile["history"]
        if row["role_category"] == "data_science"
        and row["skill"] == "python"
        and row["time_slice"] == "2025-H1"
    )

    assert python_slice["mentions"] == python_mentions
    assert python_slice["total_postings"] == len(postings)
    assert python_slice["frequency"] == python_mentions / len(postings)


def test_velocity_profile_derives_changes_without_inventing_trend_thresholds() -> None:
    profile = build_velocity_profile()
    summary = next(
        row
        for row in profile["summaries"]
        if row["role_category"] == "data_science" and row["skill"] == "python"
    )

    assert "absolute_change" in summary
    assert "percentage_change" in summary
    assert "trend" not in summary
    assert "threshold" not in summary


def test_failed_velocity_reproduction_blocks_history_integration(monkeypatch) -> None:
    original_loader = adapters.loaders.load_velocity_scores

    def mismatched_scores(*, directory=None):
        scores = original_loader(directory=directory)
        scores[0]["velocity_score"] += 0.1
        return scores

    monkeypatch.setattr(adapters.loaders, "load_velocity_scores", mismatched_scores)
    profile = build_velocity_profile()
    result = adapt_signals_for_role(
        [signal("python")], "data_science"
    )

    assert profile["status"] == "blocked"
    assert profile["mismatches"]
    assert "history" not in profile
    assert "artifact_velocity_history" not in result.signals[0]
    assert "artifact_velocity_percentage_change" not in result.signals[0]
    assert result.signals[0]["trend_source"] == "existing_engine"


def test_trend_source_is_honest_when_existing_engine_value_is_unavailable() -> None:
    result = adapt_signals_for_role(
        [{"skill": "python", "signal_score": 0.5}], "data_science"
    )

    assert result.signals[0]["trend_source"] == "unavailable"


def test_catalog_only_skills_keep_existing_engine_hours_and_are_not_filtered() -> None:
    result = adapt_signals_for_role([signal("rust")], "data_science")

    assert result.signals[0]["hours_source"] == "learning_hours"
    assert result.signals[0]["estimated_hours"] == 20
    assert "rust" in result.divergence_report["catalog_only_skills"]


def test_unknown_skill_hours_use_existing_default() -> None:
    result = adapt_signals_for_role([signal("unlisted skill")], "data_science")

    assert result.signals[0]["hours_source"] == "default"
    assert result.signals[0]["estimated_hours"] == 10


def test_skill_catalog_remains_unchanged_and_available() -> None:
    assert "rust" in SKILL_CATALOG


def test_legacy_three_field_request_matches_original_composition() -> None:
    client = TestClient(app)
    request = {
        "resume_text": "Java",
        "jd_text": "Python Python SQL",
        "budget_hours": 20,
    }
    response = client.post("/roadmap", json=request)
    expected_signals = enrich_signals_with_velocity(
        extract_signals(request["resume_text"], request["jd_text"])
    )
    expected = optimize_roadmap(expected_signals, request["budget_hours"])

    assert response.status_code == 200
    assert response.json() == expected
    assert response.content == json.dumps(expected, separators=(",", ":")).encode()
    explicit_null = client.post("/roadmap", json={**request, "target_role": None})
    assert explicit_null.content == response.content


def test_role_scoped_roadmap_keeps_existing_response_item_shape() -> None:
    client = TestClient(app)
    response = client.post(
        "/roadmap",
        json={
            "resume_text": "",
            "jd_text": "Python",
            "budget_hours": 12,
            "target_role": "data_science",
        },
    )

    assert response.status_code == 200
    assert set(response.json()) == {"budget_hours", "roadmap"}
    assert set(response.json()["roadmap"][0]) == {
        "skill",
        "hours",
        "priority",
        "reason",
        "vendor_flag",
    }
    assert response.json()["roadmap"][0]["vendor_flag"] is False


def test_api_rejects_unknown_role_with_valid_roles() -> None:
    response = TestClient(app).post(
        "/roadmap",
        json={
            "resume_text": "",
            "jd_text": "Python",
            "budget_hours": 12,
            "target_role": "unknown",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["valid_roles"] == [
        "backend_ml_engineer",
        "data_science",
        "other",
    ]


def test_api_rejects_other_role_because_it_is_not_plannable() -> None:
    response = TestClient(app).post(
        "/roadmap",
        json={
            "resume_text": "",
            "jd_text": "Python",
            "budget_hours": 12,
            "target_role": "other",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["plannable_roles"] == [
        "backend_ml_engineer",
        "data_science",
    ]


def test_proofs_endpoint_serves_normalized_records_only() -> None:
    response = TestClient(app).get("/proofs")

    assert response.status_code == 200
    proof_ids = {proof["proof_id"] for proof in response.json()}
    assert "proof-c-synthetic-benchmark" in proof_ids
    assert "proof-e-budget-sensitivity-backend_ml_engineer" in proof_ids
    assert not any(proof_id.startswith("proof-a-") for proof_id in proof_ids)
