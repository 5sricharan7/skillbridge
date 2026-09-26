import datetime
import hashlib
import json

import pytest

from backend.data import loaders
from backend.data.loaders import (
    ARTIFACT_NAMES,
    ArtifactNotFoundError,
    ArtifactParseError,
    ArtifactStructureError,
    load_all_artifacts,
    load_backtest_chart_data,
    load_cleaned_postings,
    load_dag_structure,
    load_example_curricula,
    load_hours_per_skill,
    load_proof_b_results,
    load_proof_c_results,
    load_proof_e_example,
    load_skill_scores,
    load_skill_vocabulary,
    load_thresholds,
    load_velocity_scores,
)
from backend.engines.skill_catalog import SKILL_CATALOG


EXPECTED_ARTIFACT_NAMES = (
    "cleaned_postings.parquet",
    "skill_scores.parquet",
    "thresholds.json",
    "velocity_scores.parquet",
    "backtest_chart_data.json",
    "hours_per_skill.json",
    "dag_structure.json",
    "proof_e_example.json",
    "example_curricula.json",
    "proof_b_results.json",
    "proof_c_results.json",
)


def test_artifact_directory_holds_exactly_the_finalized_artifacts() -> None:
    assert set(loaders.list_artifact_names()) == set(EXPECTED_ARTIFACT_NAMES)
    assert loaders.missing_artifact_names() == []
    assert loaders.unexpected_artifact_names() == []


def test_artifact_names_declare_the_notebook_pipeline_order() -> None:
    assert ARTIFACT_NAMES == EXPECTED_ARTIFACT_NAMES


def test_every_artifact_loads() -> None:
    artifacts = load_all_artifacts()

    assert set(artifacts) == set(EXPECTED_ARTIFACT_NAMES)
    assert all(artifacts.values())


def test_cleaned_postings_has_329_rows() -> None:
    postings = load_cleaned_postings()

    assert len(postings) == 329
    assert set(postings[0]) == {
        "job_id",
        "title",
        "company",
        "posted_date",
        "source",
        "skills",
        "role_category",
    }


def test_cleaned_postings_rows_are_plain_python() -> None:
    posting = load_cleaned_postings()[0]

    assert type(posting["posted_date"]) is datetime.datetime
    assert posting["posted_date"] == datetime.datetime(2026, 5, 5)
    assert isinstance(posting["skills"], list)
    assert all(isinstance(skill, str) for skill in posting["skills"])


def test_skill_scores_has_81_rows() -> None:
    scores = load_skill_scores()

    assert len(scores) == 81
    assert set(scores[0]) == {
        "role_category",
        "skill",
        "frequency",
        "classification",
    }


def test_velocity_scores_has_75_rows() -> None:
    scores = load_velocity_scores()

    assert len(scores) == 75
    assert set(scores[0]) == {
        "role_category",
        "skill",
        "velocity_score",
        "time_slices_used",
    }


def test_hours_per_skill_has_22_records() -> None:
    hours = load_hours_per_skill()

    assert len(hours) == 22
    assert set(hours[0]) == {"role_category", "skill", "hours", "source"}


def test_dag_structure_has_two_roles_and_22_nodes() -> None:
    dag = load_dag_structure()

    assert set(dag) == {"data_science", "backend_ml_engineer"}
    assert sum(len(nodes) for nodes in dag.values()) == 22
    assert dag["data_science"]["machine learning"] == ["python", "statistics"]


def test_dag_structure_preserves_dangling_prerequisites() -> None:
    dag = load_dag_structure()

    assert dag["backend_ml_engineer"]["django"] == ["python"]
    assert "python" not in dag["backend_ml_engineer"]


def test_thresholds_contains_the_expected_keys() -> None:
    thresholds = load_thresholds()

    assert set(thresholds) == {
        "core_min_frequency",
        "noise_max_frequency",
        "similarity_cutoff",
        "embedding_backend_used_when_tuned",
    }
    assert isinstance(thresholds["core_min_frequency"], float)
    assert isinstance(thresholds["noise_max_frequency"], float)
    assert isinstance(thresholds["similarity_cutoff"], float)
    assert isinstance(thresholds["embedding_backend_used_when_tuned"], str)


def test_backtest_chart_data_preserves_its_structure() -> None:
    backtest = load_backtest_chart_data()

    assert set(backtest) == {
        "dataset_rows",
        "date_min",
        "date_max",
        "usable_slices",
        "proof_a_candidates",
        "proof_a_results",
        "live_window",
        "trajectory_rows",
    }
    assert backtest["dataset_rows"] == len(load_cleaned_postings())


def test_proof_c_results_contains_20_benchmark_cases() -> None:
    proof_c = load_proof_c_results()

    assert proof_c["n_cases"] == 20
    assert len(proof_c["cases"]) == 20
    assert set(proof_c["cases"][0]) == {
        "role",
        "naive_gap_count",
        "signal_gap_count",
        "naive_structural_hits",
        "signal_structural_hits",
        "naive_precision",
        "signal_precision",
        "naive_gaps",
        "signal_gaps",
        "true_structural",
    }


def test_proof_b_results_preserves_its_structure() -> None:
    proof_b = load_proof_b_results()

    assert set(proof_b) == {
        "reference_description",
        "reference_urls",
        "results",
        "summary",
    }
    assert len(proof_b["results"]) == 12
    assert len(proof_b["summary"]) == 3
    assert set(proof_b["results"][0]) == {
        "role_category",
        "skill",
        "frequency",
        "external_match",
        "note",
    }


def test_proof_e_example_preserves_its_structure() -> None:
    proof_e = load_proof_e_example()

    assert set(proof_e) == {"backend_ml_engineer"}
    assert set(proof_e["backend_ml_engineer"]) == {
        "20_hours",
        "100_hours",
        "different_plan",
        "reprioritized",
    }
    assert proof_e["backend_ml_engineer"]["different_plan"] is False


def test_example_curricula_preserves_its_structure() -> None:
    curricula = load_example_curricula()

    assert len(curricula) == 1
    assert set(curricula[0]) == {
        "skill",
        "role",
        "hours_requested",
        "validated",
        "curriculum",
        "api_mode",
    }


def test_role_category_is_preserved_on_every_scored_record() -> None:
    expected_roles = {"data_science", "backend_ml_engineer", "other"}

    assert {row["role_category"] for row in load_skill_scores()} == expected_roles
    assert {row["role_category"] for row in load_velocity_scores()} == expected_roles
    assert {row["role_category"] for row in load_cleaned_postings()} == expected_roles
    assert {row["role_category"] for row in load_hours_per_skill()} == {
        "data_science",
        "backend_ml_engineer",
    }


def test_hours_and_dag_cover_the_same_role_scoped_skill_pairs() -> None:
    hours_pairs = {(row["role_category"], row["skill"]) for row in load_hours_per_skill()}
    dag_pairs = {
        (role, skill)
        for role, nodes in load_dag_structure().items()
        for skill in nodes
    }

    assert hours_pairs == dag_pairs


def test_skill_vocabulary_is_not_reduced_to_the_skill_catalog() -> None:
    vocabulary = load_skill_vocabulary()

    assert len(vocabulary["skills"]) == 64
    assert len(vocabulary["skills"]) > len(SKILL_CATALOG)
    assert {"pandas", "llm", "mlops", "spring boot"} <= set(vocabulary["skills"])
    assert set(SKILL_CATALOG) - set(vocabulary["skills"])


def test_skill_vocabulary_reports_role_and_artifact_scopes() -> None:
    vocabulary = load_skill_vocabulary()

    assert set(vocabulary["by_artifact"]) == {
        "cleaned_postings.parquet",
        "skill_scores.parquet",
        "velocity_scores.parquet",
        "hours_per_skill.json",
        "dag_structure.json",
    }
    assert set(vocabulary["by_role"]) == {
        "data_science",
        "backend_ml_engineer",
        "other",
    }
    assert vocabulary["skills"] == sorted(
        {
            skill
            for skills in vocabulary["by_artifact"].values()
            for skill in skills
        }
    )


def test_missing_artifact_raises_an_explicit_error(tmp_path) -> None:
    with pytest.raises(ArtifactNotFoundError) as error:
        loaders.load_thresholds(directory=tmp_path)

    assert "thresholds.json" in str(error.value)
    assert str(tmp_path) in str(error.value)


def test_missing_artifact_directory_raises_an_explicit_error(tmp_path) -> None:
    with pytest.raises(ArtifactNotFoundError) as error:
        loaders.load_thresholds(directory=tmp_path / "absent")

    assert "does not exist" in str(error.value)


def test_named_loaders_report_a_missing_artifact_directory(
    tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr(loaders, "artifacts_directory", lambda: tmp_path)

    with pytest.raises(ArtifactNotFoundError) as error:
        loaders.load_cleaned_postings()

    assert "cleaned_postings.parquet" in str(error.value)


def test_malformed_json_raises_an_explicit_error(tmp_path) -> None:
    (tmp_path / "thresholds.json").write_text("{not json", encoding="utf-8")

    with pytest.raises(ArtifactParseError) as error:
        loaders.load_thresholds(directory=tmp_path)

    assert "not valid JSON" in str(error.value)


def test_malformed_parquet_raises_an_explicit_error(tmp_path) -> None:
    (tmp_path / "skill_scores.parquet").write_bytes(b"PAR1 not really parquet")

    with pytest.raises(ArtifactParseError) as error:
        loaders.load_skill_scores(directory=tmp_path)

    assert "not readable Parquet" in str(error.value)


def test_unexpected_top_level_shape_raises_an_explicit_error(tmp_path) -> None:
    (tmp_path / "thresholds.json").write_text("[]", encoding="utf-8")

    with pytest.raises(ArtifactStructureError) as error:
        loaders.load_thresholds(directory=tmp_path)

    assert "must be a JSON object" in str(error.value)


def test_missing_top_level_key_raises_an_explicit_error(tmp_path) -> None:
    (tmp_path / "proof_c_results.json").write_text(
        json.dumps({"n_cases": 1}), encoding="utf-8"
    )

    with pytest.raises(ArtifactStructureError) as error:
        loaders.load_proof_c_results(directory=tmp_path)

    assert "missing required key" in str(error.value)


def test_non_object_record_raises_an_explicit_error(tmp_path) -> None:
    (tmp_path / "hours_per_skill.json").write_text("[1, 2]", encoding="utf-8")

    with pytest.raises(ArtifactStructureError) as error:
        loaders.load_hours_per_skill(directory=tmp_path)

    assert "record 0 must be a JSON object" in str(error.value)


def test_malformed_dag_role_raises_an_explicit_error(tmp_path) -> None:
    (tmp_path / "dag_structure.json").write_text(
        json.dumps({"data_science": ["python"]}), encoding="utf-8"
    )

    with pytest.raises(ArtifactStructureError) as error:
        loaders.load_dag_structure(directory=tmp_path)

    assert "must map skills to prerequisite lists" in str(error.value)


def test_loading_does_not_modify_the_artifact_files() -> None:
    directory = loaders.artifacts_directory()
    before = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(directory.iterdir())
    }

    load_all_artifacts()
    load_skill_vocabulary()

    after = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(directory.iterdir())
    }
    assert after == before


def test_returned_structures_are_not_shared_between_calls() -> None:
    first = load_skill_scores()
    first[0]["skill"] = "mutated"
    first[0]["frequency"] = -1.0

    second = load_skill_scores()
    assert second[0]["skill"] != "mutated"
    assert second[0]["frequency"] != -1.0
