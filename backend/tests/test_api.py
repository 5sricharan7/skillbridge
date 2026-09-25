from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_server_starts() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200


def test_roadmap_exists() -> None:
    response = client.post(
        "/roadmap",
        json={
            "resume_text": "Resume text",
            "jd_text": "Job description",
            "budget_hours": 60,
        },
    )
    assert response.status_code == 200


def test_roadmap_accepts_expected_request_shape() -> None:
    response = client.post(
        "/roadmap",
        json={
            "resume_text": "Resume text",
            "jd_text": "Job description",
            "budget_hours": 60,
        },
    )
    assert response.json() == {"budget_hours": 60, "roadmap": []}


def test_velocity_exists() -> None:
    response = client.get("/velocity/python")
    assert response.status_code == 200


def test_vendor_flags_exists() -> None:
    response = client.get("/vendor-flags")
    assert response.status_code == 200


def test_proofs_exists() -> None:
    response = client.get("/proofs")
    assert response.status_code == 200
