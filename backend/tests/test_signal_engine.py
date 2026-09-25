from backend.engines.signal_engine import compute_skill_signals, extract_skills


def test_skill_extraction_is_case_insensitive() -> None:
    assert extract_skills("PYTHON and Sql") == ["python", "sql"]


def test_aliases_normalize_correctly() -> None:
    assert extract_skills("Amazon Web Services, py, c programming, Node.js") == [
        "aws",
        "c",
        "node.js",
        "python",
    ]


def test_duplicate_mentions_do_not_create_duplicate_skills() -> None:
    assert extract_skills("Python Python PY") == ["python"]


def test_missing_skill_is_marked_as_gap() -> None:
    signals = compute_skill_signals("JavaScript", "Python")

    assert signals == [
        {
            "skill": "python",
            "jd_frequency": 1,
            "in_resume": False,
            "gap": True,
            "signal_score": 0.52,
            "priority": "important",
        }
    ]


def test_present_skill_is_not_marked_as_gap() -> None:
    signals = compute_skill_signals("Python", "Python")

    assert signals[0]["in_resume"] is True
    assert signals[0]["gap"] is False


def test_higher_jd_frequency_produces_stronger_signal() -> None:
    lower_frequency = compute_skill_signals("", "Python")
    higher_frequency = compute_skill_signals("", "Python Python Python")

    assert higher_frequency[0]["signal_score"] > lower_frequency[0]["signal_score"]


def test_output_ordering_is_deterministic() -> None:
    first = compute_skill_signals("", "SQL Python")
    second = compute_skill_signals("", "SQL Python")

    assert first == second
    assert [signal["skill"] for signal in first] == ["python", "sql"]


def test_empty_resume_and_jd_do_not_crash() -> None:
    assert extract_skills("") == []
    assert compute_skill_signals("", "") == []
