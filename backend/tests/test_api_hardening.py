import json

from fastapi.testclient import TestClient

from backend import main
from backend.data.adapters import build_velocity_profile


client = TestClient(main.app)


def test_health_is_minimal_deterministic_and_independent_of_pipeline(
    monkeypatch,
) -> None:
    def fail_if_called():
        raise AssertionError("health must not call proof normalization")

    monkeypatch.setattr(main, "normalize_proofs", fail_if_called)

    first = client.get("/health")
    second = client.get("/health")

    assert first.status_code == 200
    assert first.content == b'{"status":"ok"}'
    assert second.content == first.content


def test_default_cors_allows_local_vite_origin_only() -> None:
    allowed = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    rejected = client.options(
        "/health",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in rejected.headers
    assert "access-control-allow-credentials" not in allowed.headers


def test_cors_origins_are_configurable_without_wildcards(monkeypatch) -> None:
    monkeypatch.setenv(
        "SKILLBRIDGE_CORS_ORIGINS",
        " https://frontend.example , http://localhost:5173 ",
    )

    assert main._configured_cors_origins() == [
        "https://frontend.example",
        "http://localhost:5173",
    ]
    monkeypatch.setenv("SKILLBRIDGE_CORS_ORIGINS", " , ")
    assert main._configured_cors_origins() == []


def test_velocity_endpoint_retains_its_existing_public_shape() -> None:
    response = client.get("/velocity/python")

    assert response.status_code == 200
    assert set(response.json()) == {
        "skill",
        "trend",
        "percentage_change",
        "absolute_change",
        "history",
    }
    assert response.json()["history"] == [
        {"period": "2026-W01", "count": 100},
        {"period": "2026-W02", "count": 110},
        {"period": "2026-W03", "count": 125},
        {"period": "2026-W04", "count": 145},
    ]


def test_velocity_artifact_reproducibility_remains_75_of_75() -> None:
    report = build_velocity_profile()

    assert report["status"] == "pass"
    assert report["checked_scores"] == 75
    assert report["matched_scores"] == 75
    assert report["tolerance"] == 1e-9


def test_roadmap_empty_unknown_skill_and_zero_budget_are_safe() -> None:
    empty = client.post(
        "/roadmap",
        json={"resume_text": "", "jd_text": "", "budget_hours": 60},
    )
    unknown = client.post(
        "/roadmap",
        json={"resume_text": "", "jd_text": "unknown-skill", "budget_hours": 60},
    )
    zero = client.post(
        "/roadmap",
        json={"resume_text": "", "jd_text": "Python", "budget_hours": 0},
    )

    assert empty.status_code == 200
    assert empty.json() == {"budget_hours": 60, "roadmap": []}
    assert unknown.status_code == 200
    assert unknown.json() == {"budget_hours": 60, "roadmap": []}
    assert zero.status_code == 200
    assert zero.json() == {"budget_hours": 0, "roadmap": []}


def test_roadmap_result_is_deterministic_and_within_budget() -> None:
    request = {
        "resume_text": "Java",
        "jd_text": "Python SQL AWS Docker",
        "budget_hours": 24,
    }
    first = client.post("/roadmap", json=request)
    second = client.post("/roadmap", json=request)

    assert first.status_code == second.status_code == 200
    assert first.content == second.content
    assert first.content == json.dumps(
        first.json(), separators=(",", ":")
    ).encode()
    assert sum(item["hours"] for item in first.json()["roadmap"]) <= 24
    assert set(first.json()) == {"budget_hours", "roadmap"}
    assert all(
        set(item)
        == {"skill", "hours", "priority", "reason", "vendor_flag"}
        for item in first.json()["roadmap"]
    )


def test_invalid_target_role_does_not_expose_internal_paths() -> None:
    response = client.post(
        "/roadmap",
        json={
            "resume_text": "",
            "jd_text": "Python",
            "budget_hours": 12,
            "target_role": "missing",
        },
    )

    assert response.status_code == 422
    body = response.text.casefold()
    assert "valid_roles" in body
    assert "traceback" not in body
    assert "c:\\\\" not in body
    assert "backend/data/artifacts" not in body
