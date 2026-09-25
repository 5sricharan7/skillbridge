"""Deterministic prerequisite-aware roadmap planning.

The learning-hour values below are planning estimates used only by this
optimizer. They are not claims about how long any person will take to learn a
skill.
"""

import math
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any, Optional


PREREQUISITE_MAP: dict[str, tuple[str, ...]] = {
    "machine learning": ("python",),
    "deep learning": ("python",),
    "embedded systems": ("c",),
    "arduino": ("embedded systems",),
    "css": ("html",),
    "javascript": ("css",),
    "react": ("javascript",),
}

LEARNING_HOURS: dict[str, int] = {
    "python": 12,
    "java": 12,
    "javascript": 10,
    "typescript": 10,
    "react": 12,
    "node.js": 12,
    "sql": 8,
    "nosql": 10,
    "aws": 12,
    "cloud computing": 10,
    "docker": 8,
    "kubernetes": 12,
    "terraform": 10,
    "ci/cd": 8,
    "machine learning": 18,
    "deep learning": 24,
    "data structures": 16,
    "algorithms": 14,
    "git": 4,
    "linux": 8,
    "embedded systems": 15,
    "arduino": 10,
    "c": 16,
    "c++": 18,
    "vlsi": 24,
    "verilog": 20,
    "html": 6,
    "css": 8,
    "cybersecurity": 18,
    "networking": 14,
    "rest api": 8,
    "graphql": 10,
    "postgresql": 10,
    "mongodb": 10,
    "bash": 6,
    "jenkins": 8,
    "statistics": 14,
    "tensorflow": 20,
    "pytorch": 20,
    "rust": 20,
}

DEFAULT_LEARNING_HOURS = 10
PRIORITY_RANK: dict[str, int] = {
    "critical": 3,
    "important": 2,
    "supporting": 1,
}


@dataclass(frozen=True)
class _Skill:
    skill: str
    signal_score: float
    priority: str
    gap: bool
    hours: int
    prerequisites: tuple[str, ...]
    trend: str


def _as_signal_list(skills: object) -> list[Mapping[str, object]]:
    if isinstance(skills, Mapping):
        if "skill" in skills:
            return [skills]
        signals: list[Mapping[str, object]] = []
        for name, value in skills.items():
            if isinstance(value, Mapping):
                signal = dict(value)
                signal.setdefault("skill", name)
                signals.append(signal)
        return signals

    if isinstance(skills, (str, bytes)):
        return [{"skill": skills}]

    try:
        values = iter(skills)
    except TypeError:
        return []
    signals = []
    for value in values:
        if isinstance(value, Mapping):
            signals.append(value)
        elif isinstance(value, str) and value.strip():
            signals.append({"skill": value})
    return signals


def _normalize_skill(skill: str) -> str:
    return " ".join(skill.casefold().split())


def _normalize_score(value: object) -> float:
    if isinstance(value, bool):
        return 0.0
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(score):
        return 0.0
    return max(score, 0.0)


def _normalize_priority(value: object) -> str:
    if isinstance(value, str):
        priority = value.casefold().strip()
        if priority in PRIORITY_RANK:
            return priority
    return "supporting"


def _normalize_gap(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.casefold().strip() not in {"false", "0", "no", "n"}
    return bool(value)


def _normalize_trend(value: object) -> str:
    if isinstance(value, str):
        trend = value.casefold().strip()
        if trend in {"rising", "declining", "stable", "insufficient_data"}:
            return trend
    return "insufficient_data"


def _normalize_hours(skill: str, signal: Mapping[str, object]) -> int:
    for key in (
        "estimated_hours",
        "estimated_learning_hours",
        "learning_hours",
        "hours",
    ):
        value = signal.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int) and value >= 0:
            return value
        if isinstance(value, float) and math.isfinite(value) and value >= 0:
            if value.is_integer():
                return int(value)
    return LEARNING_HOURS.get(skill, DEFAULT_LEARNING_HOURS)


def _normalize_prerequisites(value: object) -> tuple[str, ...]:
    if isinstance(value, str):
        values: Iterable[object] = (value,)
    elif isinstance(value, Mapping) or not isinstance(value, Iterable):
        return ()
    else:
        values = value

    return tuple(
        sorted(
            {
                _normalize_skill(item)
                for item in values
                if isinstance(item, str) and item.strip()
            }
        )
    )


def _prepare_skills(skills: object) -> dict[str, _Skill]:
    grouped: dict[str, list[_Skill]] = {}
    for signal in _as_signal_list(skills):
        raw_skill = signal.get("skill")
        if not isinstance(raw_skill, str) or not raw_skill.strip():
            continue

        skill = _normalize_skill(raw_skill)
        node = _Skill(
            skill=skill,
            signal_score=_normalize_score(signal.get("signal_score", 0.0)),
            priority=_normalize_priority(signal.get("priority")),
            gap=_normalize_gap(signal.get("gap", True)),
            hours=_normalize_hours(skill, signal),
            prerequisites=_normalize_prerequisites(signal.get("prerequisites")),
            trend=_normalize_trend(signal.get("trend")),
        )
        grouped.setdefault(skill, []).append(node)

    prepared: dict[str, _Skill] = {}
    for skill in sorted(grouped):
        candidates = grouped[skill]
        best = min(
            candidates,
            key=lambda candidate: (
                -candidate.signal_score,
                -PRIORITY_RANK.get(candidate.priority, 0),
                candidate.hours,
                candidate.prerequisites,
            ),
        )
        prerequisites = tuple(
            sorted(
                {
                    prerequisite
                    for candidate in candidates
                    for prerequisite in candidate.prerequisites
                }
            )
        )
        prepared[skill] = _Skill(
            skill=skill,
            signal_score=max(candidate.signal_score for candidate in candidates),
            priority=best.priority,
            gap=any(candidate.gap for candidate in candidates),
            hours=best.hours,
            prerequisites=prerequisites,
            trend=best.trend,
        )
    return prepared


def _raw_graph(skills: Mapping[str, _Skill]) -> dict[str, set[str]]:
    return {
        skill: set(PREREQUISITE_MAP.get(skill, ())) | set(skill_data.prerequisites)
        for skill, skill_data in skills.items()
    }


def _reaches(start: str, target: str, graph: Mapping[str, set[str]]) -> bool:
    pending = [start]
    seen: set[str] = set()
    while pending:
        current = pending.pop()
        if current == target:
            return True
        if current in seen:
            continue
        seen.add(current)
        pending.extend(graph.get(current, ()))
    return False


def _acyclic_graph(raw_graph: Mapping[str, set[str]]) -> dict[str, tuple[str, ...]]:
    graph: dict[str, set[str]] = {skill: set() for skill in raw_graph}
    for skill in sorted(raw_graph):
        for prerequisite in sorted(raw_graph[skill]):
            if not _reaches(prerequisite, skill, raw_graph):
                graph[skill].add(prerequisite)
    return {
        skill: tuple(sorted(prerequisites))
        for skill, prerequisites in sorted(graph.items())
    }


def build_learning_graph(skills: object) -> dict[str, list[str]]:
    """Map each supplied skill to its direct prerequisites."""
    prepared = _prepare_skills(skills)
    graph = _acyclic_graph(_raw_graph(prepared))
    return {skill: list(prerequisites) for skill, prerequisites in graph.items()}


def _can_learn(
    skill: str,
    skills: Mapping[str, _Skill],
    graph: Mapping[str, tuple[str, ...]],
    memo: dict[str, bool],
) -> bool:
    if skill in memo:
        return memo[skill]

    node = skills[skill]
    if not node.gap:
        memo[skill] = True
        return True

    can_learn = True
    for prerequisite in graph.get(skill, ()):
        if prerequisite not in skills:
            can_learn = False
            break
        if skills[prerequisite].gap and not _can_learn(
            prerequisite, skills, graph, memo
        ):
            can_learn = False
            break
    memo[skill] = can_learn
    return can_learn


def _topological_order(
    skills: Iterable[str], graph: Mapping[str, tuple[str, ...]]
) -> list[str]:
    remaining = set(skills)
    ordered: list[str] = []
    while remaining:
        ready = sorted(
            skill
            for skill in remaining
            if not any(
                prerequisite in remaining
                for prerequisite in graph.get(skill, ())
            )
        )
        if not ready:
            ordered.extend(sorted(remaining))
            break
        for skill in ready:
            ordered.append(skill)
            remaining.remove(skill)
    return ordered


def _normalize_budget(budget_hours: object) -> int:
    if isinstance(budget_hours, bool):
        return 0
    try:
        return max(int(budget_hours), 0)
    except (TypeError, ValueError, OverflowError):
        return 0


def _state_is_better(
    candidate: tuple[float, tuple[int, ...]],
    current: tuple[float, tuple[int, ...]],
    order: list[str],
) -> bool:
    candidate_value, candidate_indices = candidate
    current_value, current_indices = current
    if candidate_value != current_value:
        return candidate_value > current_value
    if len(candidate_indices) != len(current_indices):
        return len(candidate_indices) > len(current_indices)

    candidate_names = tuple(order[index] for index in candidate_indices)
    current_names = tuple(order[index] for index in current_indices)
    return candidate_names < current_names


def _requirement_reason(node: _Skill) -> str:
    if node.gap:
        return f"{node.priority} requirement gap"
    return f"{node.priority} requirement already present in resume"


def _demand_reason(trend: str) -> str:
    if trend == "rising":
        return "demand is rising"
    if trend == "declining":
        return "demand is declining"
    if trend == "stable":
        return "demand is stable"
    return "demand trend unavailable"


def _roadmap_reason(
    node: _Skill,
    graph: Mapping[str, tuple[str, ...]],
    selected_set: set[str],
) -> str:
    reason = f"{_requirement_reason(node)}; {_demand_reason(node.trend)}"
    prerequisites = sorted(
        prerequisite
        for prerequisite in graph.get(node.skill, ())
        if prerequisite in selected_set
    )
    if prerequisites:
        reason += "; depends on " + ", ".join(prerequisites)
    return reason


def optimize_roadmap(skills: object, budget_hours: int) -> dict[str, object]:
    """Return the highest-signal prerequisite-closed plan within a budget."""
    budget = _normalize_budget(budget_hours)
    prepared = _prepare_skills(skills)
    graph = _acyclic_graph(_raw_graph(prepared))
    if not prepared:
        return {"budget_hours": budget, "roadmap": []}

    can_learn_memo: dict[str, bool] = {}
    candidates = sorted(
        skill
        for skill, node in prepared.items()
        if node.gap
        and _can_learn(skill, prepared, graph, can_learn_memo)
    )
    order = _topological_order(candidates, graph)
    index = {skill: position for position, skill in enumerate(order)}
    required_bits: dict[str, tuple[int, ...]] = {}
    for skill in order:
        required_bits[skill] = tuple(
            1 << index[prerequisite]
            for prerequisite in graph.get(skill, ())
            if prerequisite in index
        )

    states: dict[tuple[int, int], tuple[float, tuple[int, ...]]] = {
        (0, 0): (0.0, ())
    }
    for position, skill in enumerate(order):
        node = prepared[skill]
        bit = 1 << position
        next_states = dict(states)
        for (used_hours, selected_mask), (value, selected) in states.items():
            new_hours = used_hours + node.hours
            if new_hours > budget:
                continue
            if any(
                selected_mask & required_bit == 0
                for required_bit in required_bits[skill]
            ):
                continue

            new_mask = selected_mask | bit
            new_value = round(value + node.signal_score, 10)
            candidate = (new_value, selected + (position,))
            key = (new_hours, new_mask)
            current = next_states.get(key)
            if current is None or _state_is_better(candidate, current, order):
                next_states[key] = candidate
        states = next_states

    best_state: Optional[tuple[float, tuple[int, ...]]] = None
    for state in states.values():
        if best_state is None or _state_is_better(state, best_state, order):
            best_state = state
    selected_indices = best_state[1] if best_state is not None else ()
    selected_skills = [order[position] for position in selected_indices]
    selected_set = set(selected_skills)

    roadmap: list[dict[str, object]] = []
    for skill in selected_skills:
        node = prepared[skill]
        roadmap.append(
            {
                "skill": skill,
                "hours": node.hours,
                "priority": node.priority,
                "reason": _roadmap_reason(node, graph, selected_set),
                "vendor_flag": False,
            }
        )

    return {"budget_hours": budget, "roadmap": roadmap}


def build_roadmap(
    signals: object, budget_hours: int
) -> list[dict[str, Any]]:
    result = optimize_roadmap(signals, budget_hours)
    roadmap = result["roadmap"]
    if not isinstance(roadmap, list):
        return []
    return [dict(item) for item in roadmap if isinstance(item, Mapping)]
