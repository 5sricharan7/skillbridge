"""Stage 7A.5 — the curriculum-intelligence endpoint serves recorded values only.

Every assertion here compares the response back to a finalized artifact, so a
fabricated frequency, hour, prerequisite, or slice fails rather than passing
against a hand-written constant.
"""

from fastapi.testclient import TestClient

from backend.data import loaders
from backend.data.adapters import (
    VELOCITY_REPRODUCIBILITY_TOLERANCE,
    normalize_role,
    normalize_skill,
)
from backend.data.curriculum_intelligence import (
    CURRICULUM_INTELLIGENCE_NOT_AVAILABLE,
)
from backend.data.loaders import (
    load_hours_per_skill,
    load_skill_scores,
    load_thresholds,
    load_velocity_scores,
)
from backend.main import app


client = TestClient(app)

PLANNABLE_ROLES = ["backend_ml_engineer", "data_science"]


def artifact_skill_rows(role: str) -> list[dict[str, object]]:
    return [row for row in load_skill_scores() if row["role_category"] == role]


def artifact_velocity_rows(role: str) -> list[dict[str, object]]:
    return [row for row in load_velocity_scores() if row["role_category"] == role]


def artifact_hour_rows(role: str) -> list[dict[str, object]]:
    return [row for row in load_hours_per_skill() if row["role_category"] == role]


def test_both_plannable_roles_are_served() -> None:
    for role in PLANNABLE_ROLES:
        response = client.get(f"/curriculum-intelligence/{role}")

        assert response.status_code == 200
        body = response.json()
        assert body["role_category"] == role
        assert body["plannable"] is True
        assert body["skills"]


def test_role_name_is_normalized_the_way_the_artifacts_normalize_it() -> None:
    response = client.get("/curriculum-intelligence/  DATA_SCIENCE ")

    assert response.status_code == 200
    assert response.json()["role_category"] == "data_science"
    assert response.json() == client.get("/curriculum-intelligence/data_science").json()


def test_unknown_role_is_422_and_does_not_expose_internal_paths() -> None:
    response = client.get("/curriculum-intelligence/curriculum_time_machine")

    assert response.status_code == 422
    assert response.json()["detail"]["valid_roles"] == [
        "backend_ml_engineer",
        "data_science",
        "other",
    ]
    body = response.text.casefold()
    assert "traceback" not in body
    assert "backend/data/artifacts" not in body
    assert "c:\\\\" not in body


def test_other_is_served_as_corpus_only_and_is_not_plannable() -> None:
    response = client.get("/curriculum-intelligence/other")

    assert response.status_code == 200
    body = response.json()
    assert body["role_category"] == "other"
    assert body["plannable"] is False
    assert body["plannable_roles"] == PLANNABLE_ROLES
    assert body["skills"]
    assert all(row["hours"] is None for row in body["skills"])
    assert all(row["prerequisites"] is None for row in body["skills"])


def test_returned_skill_names_come_only_from_the_artifacts() -> None:
    for role in PLANNABLE_ROLES + ["other"]:
        body = client.get(f"/curriculum-intelligence/{role}").json()
        recorded = {
            normalize_skill(str(row["skill"]))
            for row in (
                artifact_skill_rows(role)
                + artifact_velocity_rows(role)
                + artifact_hour_rows(role)
            )
        }
        recorded |= {
            normalize_skill(skill)
            for skill in loaders.load_dag_structure().get(role, {})
        }
        returned = [row["skill"] for row in body["skills"]]

        assert len(returned) == len(set(returned))
        assert set(returned) == recorded
        assert returned == [
            row["skill"]
            for row in sorted(
                body["skills"], key=lambda row: (-(row["frequency"] or 0.0), row["skill"])
            )
        ]


def test_frequency_and_classification_match_the_skill_scores_artifact() -> None:
    for role in PLANNABLE_ROLES:
        body = client.get(f"/curriculum-intelligence/{role}").json()
        recorded = {
            str(row["skill"]): row for row in artifact_skill_rows(role)
        }

        for row in body["skills"]:
            source = recorded.get(row["skill"])
            if source is None:
                assert row["frequency"] is None
                assert row["classification"] is None
                continue
            assert row["frequency"] == source["frequency"]
            assert row["classification"] == source["classification"]


def test_velocity_score_and_time_slices_match_the_velocity_artifact() -> None:
    for role in PLANNABLE_ROLES:
        body = client.get(f"/curriculum-intelligence/{role}").json()
        recorded = {
            str(row["skill"]): row for row in artifact_velocity_rows(role)
        }

        for row in body["skills"]:
            source = recorded.get(row["skill"])
            if source is None:
                assert row["velocity_score"] is None
                assert row["time_slices_used"] is None
                continue
            assert row["velocity_score"] == source["velocity_score"]
            assert row["time_slices_used"] == source["time_slices_used"]


def test_the_two_velocity_slices_are_named_and_no_others_are_invented() -> None:
    for role in PLANNABLE_ROLES:
        body = client.get(f"/curriculum-intelligence/{role}").json()

        assert body["velocity_slices"] == ["2025-H1 -> 2026-H2"]
        assert body["corpus"]["usable_slices"] == [
            "2025-H1",
            "2025-H2",
            "2026-H1",
            "2026-H2",
        ]

    recorded = {
        str(row["time_slices_used"]) for row in load_velocity_scores()
    }
    assert recorded == {"2025-H1 -> 2026-H2"}


def test_each_skill_reports_exactly_the_two_recorded_slices() -> None:
    body = client.get("/curriculum-intelligence/data_science").json()
    with_slices = [row for row in body["skills"] if row["slices"] is not None]

    assert with_slices
    for row in with_slices:
        assert [entry["time_slice"] for entry in row["slices"]] == [
            "2025-H1",
            "2026-H2",
        ]
        for entry in row["slices"]:
            assert entry["mentions"] >= 0
            assert entry["total_postings"] > 0
        baseline, latest = row["slices"]
        assert row["absolute_change"] == latest["frequency"] - baseline["frequency"]
        assert row["percentage_change"] == (
            row["absolute_change"] / baseline["frequency"] * 100
            if baseline["frequency"]
            else None
        )


def test_slice_mentions_and_totals_reconcile_against_the_postings_artifact() -> None:
    body = client.get("/curriculum-intelligence/data_science").json()
    postings = loaders.load_cleaned_postings()

    def in_slice(posting, time_slice: str) -> bool:
        year = int(time_slice[:4])
        half = 1 if time_slice.endswith("H1") else 2
        month = posting["posted_date"].month
        return posting["posted_date"].year == year and (
            month <= 6 if half == 1 else month >= 7
        )

    role_postings = [p for p in postings if p["role_category"] == "data_science"]
    for row in body["skills"][:5]:
        for entry in row["slices"] or []:
            sliced = [p for p in role_postings if in_slice(p, entry["time_slice"])]
            assert entry["total_postings"] == len(sliced)
            assert entry["mentions"] == sum(
                row["skill"] in p["skills"] for p in sliced
            )


def test_hours_and_their_heuristic_source_come_from_the_hours_artifact() -> None:
    for role in PLANNABLE_ROLES:
        body = client.get(f"/curriculum-intelligence/{role}").json()
        recorded = {str(row["skill"]): row for row in artifact_hour_rows(role)}

        assert recorded
        for row in body["skills"]:
            source = recorded.get(row["skill"])
            if source is None:
                assert row["hours"] is None
                assert row["hours_source"] is None
                continue
            assert row["hours"] == source["hours"]
            assert row["hours_source"] == source["source"]


def test_prerequisites_match_the_dag_artifact_and_are_not_ambiguous() -> None:
    for role in PLANNABLE_ROLES:
        body = client.get(f"/curriculum-intelligence/{role}").json()
        recorded = loaders.load_dag_structure()[role]
        nodes = set(recorded)

        for row in body["skills"]:
            if row["skill"] not in recorded:
                assert row["prerequisites"] is None
                continue
            # An artifact prerequisite naming a node the role's graph does not
            # define is unresolved, so it is excluded here and reported under
            # dangling_prerequisites rather than quietly presented as satisfied.
            assert row["prerequisites"] == sorted(
                prerequisite
                for prerequisite in recorded[row["skill"]]
                if prerequisite in nodes
            )

        reported = {
            (edge["skill"], edge["prerequisite"])
            for edge in body["dangling_prerequisites"]
        }
        for skill, prerequisites in recorded.items():
            for prerequisite in prerequisites:
                if prerequisite in nodes:
                    continue
                assert (skill, prerequisite) in reported
                assert prerequisite not in next(
                    row["prerequisites"] for row in body["skills"] if row["skill"] == skill
                )


def test_a_recorded_node_without_prerequisites_is_empty_not_ambiguous() -> None:
    data_science = client.get("/curriculum-intelligence/data_science").json()
    backend = client.get("/curriculum-intelligence/backend_ml_engineer").json()

    assert next(
        row for row in data_science["skills"] if row["skill"] == "python"
    )["prerequisites"] == []
    assert next(
        row for row in data_science["skills"] if row["skill"] == "machine learning"
    )["prerequisites"] == ["python", "statistics"]
    assert next(
        row for row in data_science["skills"] if row["skill"] == "generative ai"
    )["prerequisites"] == ["llm", "python"]
    assert next(
        row for row in backend["skills"] if row["skill"] == "aws"
    )["prerequisites"] == ["docker"]


def test_evidence_keeps_proof_caveats_and_names_its_artifact() -> None:
    served = {record["proof_id"]: record for record in client.get("/proofs").json()}

    for role in PLANNABLE_ROLES:
        for record in client.get(f"/curriculum-intelligence/{role}").json()["evidence"]:
            assert record["proof_id"] in served
            assert record["caveats"] == served[record["proof_id"]]["caveats"]
            assert record["is_synthetic"] == served[record["proof_id"]]["is_synthetic"]
            assert record["source"] == served[record["proof_id"]]["source"]
            assert record["source_urls"] == served[record["proof_id"]]["source_urls"]
            assert record["artifact_source"].endswith(".json")
            assert "artifact" not in record

    ids = {
        record["proof_id"]
        for record in client.get(
            "/curriculum-intelligence/backend_ml_engineer"
        ).json()["evidence"]
    }
    assert "proof-b-backend_ml_engineer" in ids
    assert "proof-c-synthetic-benchmark" in ids
    assert "proof-e-budget-sensitivity-backend_ml_engineer" in ids
    assert not any(proof_id.startswith("proof-a-") for proof_id in ids)


def test_proof_e_is_reported_as_not_demonstrating_budget_sensitivity() -> None:
    record = next(
        item
        for item in client.get(
            "/curriculum-intelligence/backend_ml_engineer"
        ).json()["evidence"]
        if item["proof_type"] == "budget_sensitivity_example"
    )

    assert record["metrics"]["plans_identical"] is True
    assert record["metrics"]["demonstrates_budget_sensitivity"] is False


def test_corpus_thresholds_and_velocity_reproducibility_are_artifact_backed() -> None:
    bounds = loaders.load_backtest_chart_data()
    thresholds = load_thresholds()
    role = "data_science"
    response = client.get(f"/curriculum-intelligence/{role}")

    assert response.json()["corpus"] == {
        "artifact": "backtest_chart_data.json",
        "postings_artifact": "cleaned_postings.parquet",
        "dataset_rows": bounds["dataset_rows"],
        "date_min": bounds["date_min"],
        "date_max": bounds["date_max"],
        "usable_slices": list(bounds["usable_slices"]),
        "role_postings": sum(
            1
            for posting in loaders.load_cleaned_postings()
            if posting["role_category"] == role
        ),
    }
    for key, value in thresholds.items():
        assert response.json()["thresholds"][key] == value

    reproducibility = response.json()["velocity_reproducibility"]
    assert reproducibility["status"] == "pass"
    assert reproducibility["checked_scores"] == 75
    assert reproducibility["matched_scores"] == 75
    assert reproducibility["tolerance"] == VELOCITY_REPRODUCIBILITY_TOLERANCE


def test_unavailable_fields_are_declared_rather_than_filled_in() -> None:
    body = client.get("/curriculum-intelligence/data_science").json()

    assert body["not_available"] == list(CURRICULUM_INTELLIGENCE_NOT_AVAILABLE)
    for field in ("university", "programme", "academic_year", "course", "credit"):
        assert field in body["not_available"]
        assert field not in body
    for row in body["skills"]:
        assert set(row) == {
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
        }
        assert not any(
            key.endswith(("_pct", "_percent", "growth", "trend", "coverage"))
            for key in row
        )


def test_response_is_deterministic() -> None:
    first = client.get("/curriculum-intelligence/data_science")
    second = client.get("/curriculum-intelligence/data_science")

    assert first.status_code == second.status_code == 200
    assert first.content == second.content


def test_role_matching_is_not_loose_enough_to_confuse_two_roles() -> None:
    data_science = client.get("/curriculum-intelligence/data_science").json()
    backend = client.get("/curriculum-intelligence/backend_ml_engineer").json()

    assert [row["skill"] for row in data_science["skills"]] != [
        row["skill"] for row in backend["skills"]
    ]
    assert all(
        row["skill"] in {source["skill"] for source in artifact_skill_rows("data_science")}
        for row in data_science["skills"]
    )
    assert all(
        row["skill"]
        in {source["skill"] for source in artifact_skill_rows("backend_ml_engineer")}
        for row in backend["skills"]
    )


def test_endpoint_does_not_serve_the_synthetic_velocity_fixtures() -> None:
    body = client.get("/curriculum-intelligence/data_science").json()
    fixture_periods = {
        entry["period"]
        for entry in client.get("/velocity/python").json()["history"]
    }

    served_periods = {
        entry["time_slice"]
        for row in body["skills"]
        for entry in row["slices"] or []
    }
    assert fixture_periods.isdisjoint(served_periods)
    assert normalize_role("data_science") == "data_science"
