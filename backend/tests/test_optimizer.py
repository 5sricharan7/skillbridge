from backend.engines.optimizer import build_learning_graph, optimize_roadmap


def signal(
    skill: str,
    score: float,
    hours: int,
    priority: str = "important",
) -> dict[str, object]:
    return {
        "skill": skill,
        "signal_score": score,
        "priority": priority,
        "gap": True,
        "estimated_hours": hours,
    }


def test_roadmap_never_exceeds_budget() -> None:
    result = optimize_roadmap(
        [signal("python", 0.9, 12), signal("sql", 0.8, 8), signal("aws", 0.7, 12)],
        20,
    )

    assert sum(item["hours"] for item in result["roadmap"]) <= 20


def test_empty_skill_list_works() -> None:
    assert optimize_roadmap([], 30) == {"budget_hours": 30, "roadmap": []}
    assert build_learning_graph([]) == {}


def test_zero_budget_works() -> None:
    result = optimize_roadmap([signal("python", 0.9, 12)], 0)

    assert result == {"budget_hours": 0, "roadmap": []}


def test_higher_signal_skill_is_preferred_when_feasible() -> None:
    result = optimize_roadmap([signal("low", 0.2, 8), signal("high", 0.9, 8)], 8)

    assert [item["skill"] for item in result["roadmap"]] == ["high"]


def test_prerequisite_is_selected_before_dependent_skill() -> None:
    skills = [signal("machine learning", 0.9, 18), signal("python", 0.8, 12)]
    result = optimize_roadmap(skills, 30)

    assert [item["skill"] for item in result["roadmap"]] == [
        "python",
        "machine learning",
    ]
    assert build_learning_graph(skills)["machine learning"] == ["python"]


def test_dependent_skill_cannot_be_selected_without_prerequisite() -> None:
    result = optimize_roadmap([signal("machine learning", 0.9, 18)], 30)

    assert result["roadmap"] == []


def test_changing_budget_changes_the_roadmap() -> None:
    skills = [signal("python", 0.9, 12), signal("sql", 0.8, 8), signal("aws", 0.7, 12)]

    small_budget = optimize_roadmap(skills, 12)
    larger_budget = optimize_roadmap(skills, 20)

    assert [item["skill"] for item in small_budget["roadmap"]] != [
        item["skill"] for item in larger_budget["roadmap"]
    ]


def test_output_is_deterministic() -> None:
    skills = [signal("python", 0.9, 12), signal("sql", 0.8, 8), signal("aws", 0.7, 12)]

    assert optimize_roadmap(skills, 20) == optimize_roadmap(list(reversed(skills)), 20)
