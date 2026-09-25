from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def post_roadmap(
    resume_text: str = "",
    jd_text: str = "",
    budget_hours: int = 60,
) -> dict[str, object]:
    response = client.post(
        "/roadmap",
        json={
            "resume_text": resume_text,
            "jd_text": jd_text,
            "budget_hours": budget_hours,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_valid_resume_and_jd_produces_roadmap() -> None:
    result = post_roadmap("Java developer", "Python", 60)

    assert result["roadmap"]
    assert "python" in {item["skill"] for item in result["roadmap"]}


def test_roadmap_never_exceeds_budget() -> None:
    result = post_roadmap("", "Python Java SQL AWS", 30)

    assert sum(item["hours"] for item in result["roadmap"]) <= 30


def test_changing_budget_can_change_roadmap() -> None:
    small_budget = post_roadmap("", "Python Java SQL", 8)
    larger_budget = post_roadmap("", "Python Java SQL", 24)

    assert small_budget["roadmap"] != larger_budget["roadmap"]


def test_missing_jd_skills_are_prioritized() -> None:
    result = post_roadmap("Java", "Java Python SQL", 8)
    selected = {item["skill"] for item in result["roadmap"]}

    assert "sql" in selected
    assert "java" not in selected


def test_velocity_information_reaches_roadmap_reasoning() -> None:
    result = post_roadmap("", "Python", 60)
    python = next(item for item in result["roadmap"] if item["skill"] == "python")

    assert "important requirement gap" in python["reason"]
    assert "demand is rising" in python["reason"]


def test_unknown_velocity_data_does_not_crash() -> None:
    result = post_roadmap("", "Rust", 60)
    rust = next(item for item in result["roadmap"] if item["skill"] == "rust")

    assert "demand trend unavailable" in rust["reason"]


def test_empty_inputs_are_handled_safely() -> None:
    empty_result = post_roadmap("", "", 60)
    empty_jd_result = post_roadmap("Python", "", 60)

    assert empty_result == {"budget_hours": 60, "roadmap": []}
    assert empty_jd_result == {"budget_hours": 60, "roadmap": []}


def test_zero_budget_returns_empty_roadmap() -> None:
    assert post_roadmap("", "Python", 0) == {
        "budget_hours": 0,
        "roadmap": [],
    }


def test_api_response_matches_existing_contract() -> None:
    result = post_roadmap("", "Python", 60)

    assert set(result) == {"budget_hours", "roadmap"}
    for item in result["roadmap"]:
        assert set(item) == {
            "skill",
            "hours",
            "priority",
            "reason",
            "vendor_flag",
        }
        assert item["vendor_flag"] is False


def test_negative_budget_is_rejected_without_crashing() -> None:
    response = client.post(
        "/roadmap",
        json={"resume_text": "", "jd_text": "Python", "budget_hours": -1},
    )

    assert response.status_code == 422
