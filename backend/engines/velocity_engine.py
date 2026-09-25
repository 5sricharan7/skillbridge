"""Deterministic velocity calculations from ordered local observations.

Percentage change is the latest count minus the baseline count, divided by the
baseline count and multiplied by 100. Scores at or above 10 percent are rising,
scores at or below -10 percent are declining, and other scores are stable.
"""

from collections.abc import Iterable, Mapping
from typing import Optional, TypedDict

from .velocity_data import get_sample_history


RISING_PERCENTAGE_THRESHOLD = 10.0
DECLINING_PERCENTAGE_THRESHOLD = -10.0


class VelocityObservation(TypedDict):
    period: str
    count: int


class VelocityMetrics(TypedDict):
    baseline_count: Optional[int]
    latest_count: Optional[int]
    absolute_change: Optional[int]
    percentage_change: Optional[float]
    trend: str


def _insufficient_metrics() -> VelocityMetrics:
    return {
        "baseline_count": None,
        "latest_count": None,
        "absolute_change": None,
        "percentage_change": None,
        "trend": "insufficient_data",
    }


def _normalize_history(
    history: Optional[Iterable[Mapping[str, object]]],
) -> list[VelocityObservation]:
    if history is None:
        return []

    observations: list[VelocityObservation] = []
    for observation in history:
        if not isinstance(observation, Mapping):
            continue

        period = observation.get("period")
        count = observation.get("count")
        if not isinstance(period, str) or not period.strip():
            continue
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            continue

        observations.append({"period": period.strip(), "count": count})

    return sorted(observations, key=lambda observation: observation["period"])


def _classify_trend(percentage_change: float) -> str:
    if percentage_change >= RISING_PERCENTAGE_THRESHOLD:
        return "rising"
    if percentage_change <= DECLINING_PERCENTAGE_THRESHOLD:
        return "declining"
    return "stable"


def compute_velocity(
    history: Optional[Iterable[Mapping[str, object]]],
) -> VelocityMetrics:
    observations = _normalize_history(history)
    if len(observations) < 2:
        return _insufficient_metrics()

    baseline_count = observations[0]["count"]
    latest_count = observations[-1]["count"]
    absolute_change = latest_count - baseline_count

    if baseline_count == 0:
        return {
            "baseline_count": baseline_count,
            "latest_count": latest_count,
            "absolute_change": absolute_change,
            "percentage_change": None,
            "trend": "insufficient_data",
        }

    percentage_change = round((absolute_change / baseline_count) * 100, 2)
    return {
        "baseline_count": baseline_count,
        "latest_count": latest_count,
        "absolute_change": absolute_change,
        "percentage_change": percentage_change,
        "trend": _classify_trend(percentage_change),
    }


def normalize_skill(skill: str) -> str:
    return " ".join(skill.casefold().split())


def get_skill_velocity(skill: str) -> dict[str, object]:
    normalized_skill = normalize_skill(skill)
    history = _normalize_history(get_sample_history(normalized_skill))
    metrics = compute_velocity(history)

    return {
        "skill": normalized_skill,
        "trend": metrics["trend"],
        "percentage_change": metrics["percentage_change"],
        "absolute_change": metrics["absolute_change"],
        "history": history,
    }


def estimate_velocity(skill: str) -> float:
    percentage_change = get_skill_velocity(skill)["percentage_change"]
    return float(percentage_change) if percentage_change is not None else 0.0
