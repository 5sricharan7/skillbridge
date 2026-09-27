"""Explicit adapters between notebook artifacts and the existing engines.

Artifact vocabulary, role data, hours, prerequisites, and velocity history are
kept separate from the source artifacts. Nothing in this module rewrites an
artifact or changes the signal engine's ranking fields.
"""

import re
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from math import isfinite
from typing import Optional

if __package__ and "." in __package__:
    from ..engines.optimizer import (
        DEFAULT_LEARNING_HOURS,
        LEARNING_HOURS,
        PREREQUISITE_MAP,
    )
    from ..engines.skill_catalog import SKILL_CATALOG
else:
    from engines.optimizer import (
        DEFAULT_LEARNING_HOURS,
        LEARNING_HOURS,
        PREREQUISITE_MAP,
    )
    from engines.skill_catalog import SKILL_CATALOG
from . import loaders


TIME_SLICES = ("2025-H1", "2025-H2", "2026-H1", "2026-H2")
VELOCITY_REPRODUCIBILITY_TOLERANCE = 1e-9
_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")

SKILL_ALIASES: dict[str, dict[str, str]] = {
    "statistical analysis": {
        "canonical": "statistics",
        "evidence": (
            "Stage 3 semantic adapter analysis documented statistical analysis "
            "as an explicit alias of statistics."
        ),
    }
}


class AdapterError(ValueError):
    """Base class for explicit artifact adapter failures."""


class UnknownTargetRoleError(AdapterError):
    def __init__(self, role: str, valid_roles: Sequence[str]) -> None:
        self.role = role
        self.valid_roles = tuple(valid_roles)
        super().__init__(
            f"Unknown target_role {role!r}. Valid roles: "
            f"{', '.join(self.valid_roles)}."
        )


class UnplannableTargetRoleError(AdapterError):
    def __init__(self, role: str, plannable_roles: Sequence[str]) -> None:
        self.role = role
        self.plannable_roles = tuple(plannable_roles)
        super().__init__(
            f"target_role {role!r} has no role-scoped hours and DAG planning "
            f"data. Plannable roles: {', '.join(self.plannable_roles)}."
        )


class ArtifactGraphCycleError(AdapterError):
    def __init__(self, role: str, cycles: Sequence[Sequence[str]]) -> None:
        self.role = role
        self.cycles = tuple(tuple(cycle) for cycle in cycles)
        super().__init__(f"Artifact prerequisite graph for {role!r} is cyclic: {self.cycles}.")


@dataclass(frozen=True)
class SkillResolution:
    input_skill: str
    normalized_skill: str
    canonical_skill: str
    match_type: str
    evidence: Optional[str]
    token_signature_candidates: tuple[str, ...]


@dataclass(frozen=True)
class RoleAdapterResult:
    target_role: str
    signals: list[dict[str, object]]
    divergence_report: dict[str, object]
    velocity_reproducibility: dict[str, object]


def normalize_skill(skill: str) -> str:
    """Apply the optimizer's casefold-and-whitespace normalization only."""
    if not isinstance(skill, str):
        raise TypeError("skill must be a string")
    return " ".join(skill.casefold().split())


def normalize_role(role: str) -> str:
    """Normalize roles exactly like skill keys, without punctuation stripping."""
    if not isinstance(role, str):
        raise TypeError("role must be a string")
    return " ".join(role.casefold().split())


def token_signature(skill: str) -> tuple[str, ...]:
    """Return an assertion-only signature; it is never used to merge skills."""
    return tuple(_TOKEN_PATTERN.findall(normalize_skill(skill)))


def token_signature_collisions(skills: Sequence[str]) -> list[dict[str, object]]:
    grouped: dict[tuple[str, ...], set[str]] = defaultdict(set)
    for skill in skills:
        normalized = normalize_skill(skill)
        signature = token_signature(normalized)
        if signature:
            grouped[signature].add(normalized)
    return [
        {
            "token_signature": signature,
            "skills": sorted(names),
            "assertion_only": True,
        }
        for signature, names in sorted(grouped.items())
        if len(names) > 1
    ]


def resolve_skill_name(
    skill: str, known_skills: Sequence[str]
) -> SkillResolution:
    """Resolve exact names or the sole evidenced alias; never resolve by signature."""
    normalized = normalize_skill(skill)
    known_by_normalized = {
        normalize_skill(candidate): normalize_skill(candidate)
        for candidate in known_skills
    }

    if normalized in known_by_normalized:
        return SkillResolution(
            input_skill=skill,
            normalized_skill=normalized,
            canonical_skill=known_by_normalized[normalized],
            match_type="exact",
            evidence=None,
            token_signature_candidates=(),
        )

    alias = SKILL_ALIASES.get(normalized)
    if alias is not None:
        canonical = alias["canonical"]
        if canonical in known_by_normalized:
            return SkillResolution(
                input_skill=skill,
                normalized_skill=normalized,
                canonical_skill=canonical,
                match_type="explicit_alias",
                evidence=alias["evidence"],
                token_signature_candidates=(),
            )

    signature = token_signature(normalized)
    candidates = tuple(
        sorted(
            candidate
            for candidate in known_by_normalized
            if signature and token_signature(candidate) == signature
        )
    )
    return SkillResolution(
        input_skill=skill,
        normalized_skill=normalized,
        canonical_skill=normalized,
        match_type="unmatched",
        evidence=None,
        token_signature_candidates=candidates,
    )


def build_skill_vocabulary(*, directory=None) -> dict[str, object]:
    """Return the union of artifact and catalog skills without dropping either."""
    artifact_vocabulary = loaders.load_skill_vocabulary(directory=directory)
    artifact_skills = sorted(
        {normalize_skill(skill) for skill in artifact_vocabulary["skills"]}
    )
    catalog_skills = sorted({normalize_skill(skill) for skill in SKILL_CATALOG})
    all_skills = sorted(set(artifact_skills) | set(catalog_skills))
    return {
        "skills": all_skills,
        "artifact_skills": artifact_skills,
        "catalog_skills": catalog_skills,
        "artifact_only_skills": sorted(set(artifact_skills) - set(catalog_skills)),
        "catalog_only_skills": sorted(set(catalog_skills) - set(artifact_skills)),
        "token_signature_collisions": token_signature_collisions(all_skills),
    }


def artifact_roles(*, directory=None) -> list[str]:
    """Return the normalized union of roles represented by the artifacts."""
    roles: set[str] = set()
    for row in loaders.load_skill_scores(directory=directory):
        roles.add(normalize_role(row["role_category"]))
    for row in loaders.load_velocity_scores(directory=directory):
        roles.add(normalize_role(row["role_category"]))
    for row in loaders.load_cleaned_postings(directory=directory):
        roles.add(normalize_role(row["role_category"]))
    for row in loaders.load_hours_per_skill(directory=directory):
        roles.add(normalize_role(row["role_category"]))
    roles.update(
        normalize_role(role)
        for role in loaders.load_dag_structure(directory=directory)
    )
    return sorted(roles)


def plannable_roles(*, directory=None) -> list[str]:
    """Derive roles with planning support from the intersection of hours and DAG."""
    roles_with_hours = {
        normalize_role(row["role_category"])
        for row in loaders.load_hours_per_skill(directory=directory)
    }
    roles_with_dag = {
        normalize_role(role)
        for role in loaders.load_dag_structure(directory=directory)
    }
    return sorted(roles_with_hours & roles_with_dag)


def validate_target_role(target_role: str, *, directory=None) -> str:
    """Normalize and validate an explicit role, including planning availability."""
    role = normalize_role(target_role)
    known_roles = artifact_roles(directory=directory)
    if role not in known_roles:
        raise UnknownTargetRoleError(role, known_roles)
    planning_roles = plannable_roles(directory=directory)
    if role not in planning_roles:
        raise UnplannableTargetRoleError(role, planning_roles)
    return role


def find_dag_cycles(graph: Mapping[str, Sequence[str]]) -> list[list[str]]:
    """Return deterministic cycle paths without deleting any graph edges."""
    state: dict[str, int] = {}
    stack: list[str] = []
    cycles: set[tuple[str, ...]] = set()

    def visit(node: str) -> None:
        state[node] = 1
        stack.append(node)
        for prerequisite in sorted(graph.get(node, ())):
            if prerequisite not in graph:
                continue
            if state.get(prerequisite, 0) == 0:
                visit(prerequisite)
            elif state.get(prerequisite) == 1:
                start = stack.index(prerequisite)
                cycle = stack[start:] + [prerequisite]
                cycles.add(_canonical_cycle(cycle[:-1]))
        stack.pop()
        state[node] = 2

    for node in sorted(graph):
        if state.get(node, 0) == 0:
            visit(node)
    return [list(cycle) + [cycle[0]] for cycle in sorted(cycles)]


def _canonical_cycle(cycle: Sequence[str]) -> tuple[str, ...]:
    rotations = [
        tuple(cycle[index:]) + tuple(cycle[:index]) for index in range(len(cycle))
    ]
    return min(rotations)


def _artifact_skill_key(skill: str) -> str:
    return resolve_skill_name(skill, tuple(SKILL_CATALOG)).canonical_skill


def _hours_value(value: object, *, source: str) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{source} learning hours must be a non-negative number")
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, float) and isfinite(value) and value >= 0 and value.is_integer():
        return int(value)
    raise ValueError(f"{source} learning hours must be a non-negative integer")


def _caller_signal_hours(signal: Mapping[str, object]) -> Optional[int]:
    for key in (
        "estimated_hours",
        "estimated_learning_hours",
        "learning_hours",
        "hours",
    ):
        if key in signal:
            return _hours_value(signal[key], source="caller")
    return None


def _caller_hours_map(
    caller_hours: Optional[Mapping[str, object]],
) -> dict[str, int]:
    resolved: dict[str, int] = {}
    if caller_hours is None:
        return resolved
    for skill, value in caller_hours.items():
        normalized = normalize_skill(skill)
        canonical = resolve_skill_name(normalized, tuple(SKILL_CATALOG)).canonical_skill
        resolved[canonical] = _hours_value(value, source="caller")
    return resolved


def _normalize_role_dag(
    role: str, *, directory=None
) -> tuple[dict[str, list[str]], dict[str, object]]:
    raw_dag = loaders.load_dag_structure(directory=directory)[role]
    normalized: dict[str, list[str]] = {}
    for raw_skill, raw_prerequisites in raw_dag.items():
        skill = _artifact_skill_key(raw_skill)
        prerequisites = sorted(
            {_artifact_skill_key(prerequisite) for prerequisite in raw_prerequisites}
        )
        if skill in normalized:
            normalized[skill] = sorted(set(normalized[skill]) | set(prerequisites))
        else:
            normalized[skill] = prerequisites

    resolved: dict[str, list[str]] = {skill: [] for skill in normalized}
    dangling_edges: list[dict[str, str]] = []
    for skill, prerequisites in sorted(normalized.items()):
        for prerequisite in prerequisites:
            if prerequisite in normalized:
                resolved[skill].append(prerequisite)
            else:
                dangling_edges.append(
                    {"role_category": role, "skill": skill, "prerequisite": prerequisite}
                )

    cycles = find_dag_cycles(normalized)
    conflicts = []
    for skill in sorted(set(normalized) & set(PREREQUISITE_MAP)):
        engine_prerequisites = sorted(
            normalize_skill(prerequisite)
            for prerequisite in PREREQUISITE_MAP[skill]
        )
        artifact_prerequisites = normalized[skill]
        if engine_prerequisites != artifact_prerequisites:
            conflicts.append(
                {
                    "role_category": role,
                    "skill": skill,
                    "engine_prerequisites": engine_prerequisites,
                    "artifact_prerequisites": artifact_prerequisites.copy(),
                    "semantics": "additive; existing engine prerequisites are retained",
                }
            )

    report = {
        "artifact_dag": deepcopy(raw_dag),
        "normalized_artifact_dag": deepcopy(normalized),
        "dag_resolved_edges": [
            {"role_category": role, "skill": skill, "prerequisite": prerequisite}
            for skill, prerequisites in sorted(resolved.items())
            for prerequisite in prerequisites
        ],
        "dag_dangling_edges": dangling_edges,
        "dag_conflicts": conflicts,
        "dag_cycles": cycles,
    }
    return resolved, report


def _slice_for_date(value: object) -> Optional[str]:
    if isinstance(value, datetime):
        year, half = value.year, 1 if value.month <= 6 else 2
    else:
        return None
    time_slice = f"{year}-H{half}"
    return time_slice if time_slice in TIME_SLICES else None


def _derive_raw_velocity_history(*, directory=None) -> tuple[
    dict[tuple[str, str, str], dict[str, object]], Counter[tuple[str, str]]
]:
    totals: Counter[tuple[str, str]] = Counter()
    mentions: Counter[tuple[str, str, str]] = Counter()
    skills_by_role: dict[str, set[str]] = defaultdict(set)

    for posting in loaders.load_cleaned_postings(directory=directory):
        role = normalize_role(posting["role_category"])
        time_slice = _slice_for_date(posting["posted_date"])
        if time_slice is None:
            continue
        totals[(role, time_slice)] += 1
        for raw_skill in set(posting["skills"]):
            skill = normalize_skill(raw_skill)
            skills_by_role[role].add(skill)
            mentions[(role, skill, time_slice)] += 1

    history: dict[tuple[str, str, str], dict[str, object]] = {}
    for role, skills in sorted(skills_by_role.items()):
        for skill in sorted(skills):
            for time_slice in TIME_SLICES:
                total_postings = totals[(role, time_slice)]
                skill_mentions = mentions[(role, skill, time_slice)]
                history[(role, skill, time_slice)] = {
                    "role_category": role,
                    "skill": skill,
                    "time_slice": time_slice,
                    "mentions": skill_mentions,
                    "total_postings": total_postings,
                    "frequency": (
                        skill_mentions / total_postings if total_postings else None
                    ),
                }
    return history, totals


def build_velocity_profile(*, directory=None) -> dict[str, object]:
    """Derive four half-year histories, publishing them only after score reproduction."""
    raw_history, _totals = _derive_raw_velocity_history(directory=directory)
    checks: list[dict[str, object]] = []
    mismatches: list[dict[str, object]] = []
    stored_rows = loaders.load_velocity_scores(directory=directory)
    for stored in stored_rows:
        role = normalize_role(stored["role_category"])
        skill = normalize_skill(stored["skill"])
        slices_used = stored["time_slices_used"].split(" -> ")
        if len(slices_used) != 2 or any(item not in TIME_SLICES for item in slices_used):
            mismatches.append(
                {
                    "role_category": role,
                    "skill": skill,
                    "stored_score": stored["velocity_score"],
                    "reason": f"unsupported time_slices_used: {stored['time_slices_used']!r}",
                }
            )
            continue

        baseline = raw_history.get((role, skill, slices_used[0]))
        latest = raw_history.get((role, skill, slices_used[1]))
        baseline_frequency = None if baseline is None else baseline["frequency"]
        latest_frequency = None if latest is None else latest["frequency"]
        if (
            not isinstance(baseline_frequency, (int, float))
            or not isinstance(latest_frequency, (int, float))
            or baseline_frequency + latest_frequency == 0
        ):
            mismatches.append(
                {
                    "role_category": role,
                    "skill": skill,
                    "stored_score": stored["velocity_score"],
                    "reason": "baseline/latest frequency is unavailable or has zero sum",
                }
            )
            continue

        reconstructed = (
            (latest_frequency - baseline_frequency)
            / (latest_frequency + baseline_frequency)
        )
        difference = abs(reconstructed - stored["velocity_score"])
        check = {
            "role_category": role,
            "skill": skill,
            "stored_score": stored["velocity_score"],
            "reconstructed_score": reconstructed,
            "absolute_difference": difference,
        }
        checks.append(check)
        if difference > VELOCITY_REPRODUCIBILITY_TOLERANCE:
            mismatches.append(check)

    report: dict[str, object] = {
        "status": "pass" if not mismatches else "blocked",
        "tolerance": VELOCITY_REPRODUCIBILITY_TOLERANCE,
        "checked_scores": len(stored_rows),
        "matched_scores": len(stored_rows) - len(mismatches),
        "mismatches": mismatches,
    }
    if mismatches:
        return report

    derived_history = []
    summaries = []
    for role, skill, time_slice in sorted(raw_history):
        derived_history.append(raw_history[(role, skill, time_slice)].copy())

    grouped: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    for row in derived_history:
        grouped[(row["role_category"], row["skill"])].append(row)
    for (role, skill), observations in sorted(grouped.items()):
        baseline_frequency = observations[0]["frequency"]
        latest_frequency = observations[-1]["frequency"]
        if (
            isinstance(baseline_frequency, (int, float))
            and isinstance(latest_frequency, (int, float))
        ):
            absolute_change = latest_frequency - baseline_frequency
            percentage_change = (
                (absolute_change / baseline_frequency) * 100
                if baseline_frequency != 0
                else None
            )
        else:
            absolute_change = None
            percentage_change = None
        summaries.append(
            {
                "role_category": role,
                "skill": skill,
                "absolute_change": absolute_change,
                "percentage_change": percentage_change,
            }
        )

    report["history"] = derived_history
    report["summaries"] = summaries
    return report


def adapt_signals_for_role(
    signals: Sequence[Mapping[str, object]],
    target_role: str,
    *,
    caller_hours: Optional[Mapping[str, object]] = None,
    directory=None,
) -> RoleAdapterResult:
    """Attach role priors, hours, resolved artifact prerequisites, and provenance."""
    role = validate_target_role(target_role, directory=directory)
    role_hours = {
        _artifact_skill_key(row["skill"]): (
            _hours_value(row["hours"], source="artifact"),
            row["source"],
        )
        for row in loaders.load_hours_per_skill(directory=directory)
        if normalize_role(row["role_category"]) == role
    }
    role_scores = {
        _artifact_skill_key(row["skill"]): {
            "prior_frequency": row["frequency"],
            "classification": row["classification"],
        }
        for row in loaders.load_skill_scores(directory=directory)
        if normalize_role(row["role_category"]) == role
    }
    role_dag, dag_report = _normalize_role_dag(role, directory=directory)
    if dag_report["dag_cycles"]:
        raise ArtifactGraphCycleError(role, dag_report["dag_cycles"])

    caller_hours_by_skill = _caller_hours_map(caller_hours)
    vocabulary = build_skill_vocabulary(directory=directory)
    hours_conflicts = []
    for skill, (hours, source) in sorted(role_hours.items()):
        existing = LEARNING_HOURS.get(skill)
        if existing is not None and existing != hours:
            hours_conflicts.append(
                {
                    "role_category": role,
                    "skill": skill,
                    "learning_hours": existing,
                    "artifact_hours": hours,
                    "artifact_source": source,
                }
            )

    velocity_profile = build_velocity_profile(directory=directory)
    velocity_summary = {
        (entry["role_category"], entry["skill"]): entry
        for entry in velocity_profile.get("summaries", [])
    }
    artifact_velocity_history: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    if velocity_profile["status"] == "pass":
        for entry in velocity_profile["history"]:
            if entry["role_category"] == role:
                artifact_velocity_history[(role, entry["skill"])].append(entry)

    enriched: list[dict[str, object]] = []
    for raw_signal in signals:
        signal = dict(raw_signal)
        raw_skill = signal.get("skill")
        if not isinstance(raw_skill, str) or not raw_skill.strip():
            enriched.append(signal)
            continue
        skill = normalize_skill(raw_skill)
        resolution = resolve_skill_name(skill, tuple(SKILL_CATALOG))
        canonical_skill = resolution.canonical_skill
        signal["skill_resolution"] = {
            "input_skill": resolution.input_skill,
            "normalized_skill": resolution.normalized_skill,
            "canonical_skill": canonical_skill,
            "match_type": resolution.match_type,
            "evidence": resolution.evidence,
        }
        artifact_entry = role_scores.get(canonical_skill)

        if artifact_entry is not None:
            signal.update(artifact_entry)
        if canonical_skill in role_dag:
            signal["prerequisites"] = list(role_dag[canonical_skill])

        caller_value = caller_hours_by_skill.get(canonical_skill)
        if caller_value is None:
            caller_value = _caller_signal_hours(signal)
        if caller_value is not None:
            resolved_hours, hours_source = caller_value, "caller"
        elif canonical_skill in LEARNING_HOURS:
            resolved_hours = LEARNING_HOURS[canonical_skill]
            hours_source = "learning_hours"
        elif canonical_skill in role_hours:
            resolved_hours = role_hours[canonical_skill][0]
            hours_source = "artifact"
        else:
            resolved_hours = DEFAULT_LEARNING_HOURS
            hours_source = "default"
        signal["estimated_hours"] = resolved_hours
        signal["hours_source"] = hours_source

        trend = signal.get("trend")
        signal["trend_source"] = (
            "existing_engine"
            if isinstance(trend, str)
            and trend in {"rising", "declining", "stable", "insufficient_data"}
            else "unavailable"
        )
        history_key = (role, canonical_skill)
        if velocity_profile["status"] == "pass" and history_key in artifact_velocity_history:
            signal["artifact_velocity_history"] = deepcopy(
                artifact_velocity_history[history_key]
            )
            summary = velocity_summary.get(history_key)
            if summary is not None:
                signal["artifact_velocity_absolute_change"] = summary[
                    "absolute_change"
                ]
                signal["artifact_velocity_percentage_change"] = summary[
                    "percentage_change"
                ]
        enriched.append(signal)

    divergence_report: dict[str, object] = {
        "target_role": role,
        "roles": artifact_roles(directory=directory),
        "plannable_roles": plannable_roles(directory=directory),
        "artifact_only_skills": vocabulary["artifact_only_skills"],
        "catalog_only_skills": vocabulary["catalog_only_skills"],
        "token_signature_collisions": vocabulary["token_signature_collisions"],
        "hours_conflicts": hours_conflicts,
        **dag_report,
    }
    return RoleAdapterResult(
        target_role=role,
        signals=enriched,
        divergence_report=divergence_report,
        velocity_reproducibility=velocity_profile,
    )
