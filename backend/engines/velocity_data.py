"""Deterministic development fixtures for velocity examples.

These counts are synthetic sample data for local development and tests. They
are not observed job-market statistics and are intended to be replaced by a
generated artifact from the data pipeline later.
"""

SAMPLE_VELOCITY_HISTORY: dict[str, tuple[dict[str, object], ...]] = {
    "python": (
        {"period": "2026-W01", "count": 100},
        {"period": "2026-W02", "count": 110},
        {"period": "2026-W03", "count": 125},
        {"period": "2026-W04", "count": 145},
    ),
    "java": (
        {"period": "2026-W01", "count": 100},
        {"period": "2026-W02", "count": 102},
        {"period": "2026-W03", "count": 101},
        {"period": "2026-W04", "count": 99},
    ),
    "sql": (
        {"period": "2026-W01", "count": 100},
        {"period": "2026-W02", "count": 95},
        {"period": "2026-W03", "count": 90},
        {"period": "2026-W04", "count": 80},
    ),
    "aws": (
        {"period": "2026-W01", "count": 50},
        {"period": "2026-W02", "count": 60},
        {"period": "2026-W03", "count": 70},
        {"period": "2026-W04", "count": 80},
    ),
    "machine learning": (
        {"period": "2026-W01", "count": 40},
        {"period": "2026-W02", "count": 45},
        {"period": "2026-W03", "count": 55},
        {"period": "2026-W04", "count": 60},
    ),
    "embedded systems": (
        {"period": "2026-W01", "count": 30},
        {"period": "2026-W02", "count": 29},
        {"period": "2026-W03", "count": 30},
        {"period": "2026-W04", "count": 30},
    ),
    "web development": (
        {"period": "2026-W01", "count": 70},
        {"period": "2026-W02", "count": 65},
        {"period": "2026-W03", "count": 60},
        {"period": "2026-W04", "count": 55},
    ),
    "vlsi": (
        {"period": "2026-W01", "count": 20},
        {"period": "2026-W02", "count": 21},
        {"period": "2026-W03", "count": 22},
        {"period": "2026-W04", "count": 23},
    ),
}


def get_sample_history(skill: str) -> list[dict[str, object]]:
    return [dict(observation) for observation in SAMPLE_VELOCITY_HISTORY.get(skill, ())]
