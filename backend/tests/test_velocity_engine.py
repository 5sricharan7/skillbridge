from fastapi.testclient import TestClient

from backend.engines.velocity_engine import (
    compute_velocity,
    get_skill_velocity,
)
from backend.main import app


client = TestClient(app)


def test_increasing_history_is_rising() -> None:
    result = compute_velocity(
        [
            {"period": "2026-W01", "count": 100},
            {"period": "2026-W02", "count": 110},
            {"period": "2026-W03", "count": 125},
            {"period": "2026-W04", "count": 145},
        ]
    )

    assert result["trend"] == "rising"
    assert result["baseline_count"] == 100
    assert result["latest_count"] == 145
    assert result["absolute_change"] == 45
    assert result["percentage_change"] == 45.0


def test_decreasing_history_is_declining() -> None:
    result = compute_velocity(
        [
            {"period": "2026-W01", "count": 100},
            {"period": "2026-W02", "count": 95},
            {"period": "2026-W03", "count": 90},
            {"period": "2026-W04", "count": 80},
        ]
    )

    assert result["trend"] == "declining"
    assert result["absolute_change"] == -20
    assert result["percentage_change"] == -20.0


def test_small_change_is_stable() -> None:
    result = compute_velocity(
        [
            {"period": "2026-W01", "count": 100},
            {"period": "2026-W02", "count": 102},
            {"period": "2026-W03", "count": 105},
        ]
    )

    assert result["trend"] == "stable"
    assert result["percentage_change"] == 5.0


def test_zero_baseline_is_handled_safely() -> None:
    result = compute_velocity(
        [
            {"period": "2026-W01", "count": 0},
            {"period": "2026-W02", "count": 5},
        ]
    )

    assert result["baseline_count"] == 0
    assert result["absolute_change"] == 5
    assert result["percentage_change"] is None
    assert result["trend"] == "insufficient_data"


def test_empty_history_is_handled_safely() -> None:
    assert compute_velocity([]) == {
        "baseline_count": None,
        "latest_count": None,
        "absolute_change": None,
        "percentage_change": None,
        "trend": "insufficient_data",
    }


def test_one_observation_is_handled_safely() -> None:
    result = compute_velocity([{"period": "2026-W01", "count": 100}])

    assert result["trend"] == "insufficient_data"
    assert result["percentage_change"] is None


def test_multiple_observations_produce_deterministic_output() -> None:
    history = [
        {"period": "2026-W03", "count": 125},
        {"period": "2026-W01", "count": 100},
        {"period": "2026-W04", "count": 145},
        {"period": "2026-W02", "count": 110},
    ]

    assert compute_velocity(history) == compute_velocity(list(reversed(history)))
    assert compute_velocity(history)["baseline_count"] == 100


def test_unknown_skill_returns_insufficient_data() -> None:
    assert get_skill_velocity("unknown-skill") == {
        "skill": "unknown-skill",
        "trend": "insufficient_data",
        "percentage_change": None,
        "absolute_change": None,
        "history": [],
    }


def test_velocity_endpoint_returns_valid_json() -> None:
    response = client.get("/velocity/PYTHON")

    assert response.status_code == 200
    assert response.json() == {
        "skill": "python",
        "trend": "rising",
        "percentage_change": 45.0,
        "absolute_change": 45,
        "history": [
            {"period": "2026-W01", "count": 100},
            {"period": "2026-W02", "count": 110},
            {"period": "2026-W03", "count": 125},
            {"period": "2026-W04", "count": 145},
        ],
    }
