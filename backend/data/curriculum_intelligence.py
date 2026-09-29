"""Role-scoped, artifact-backed view for the Curriculum Time Machine.

Stage 7A established that this repository contains no university, programme,
year, credit, or course record. This module therefore exposes only what the
finalized Notebook 1-5 artifacts actually hold: per-role skill frequency, the
Notebook 2 classification, the Notebook 3 velocity score across exactly the time
slices that were recorded, the Notebook 4 role-scoped learning hours and
prerequisite graph, and the role-scoped proof records already served by
``/proofs``.

Nothing here reads the synthetic ``/velocity/{skill}`` fixtures, and nothing is
interpolated, averaged, extrapolated, or reduced to a trend label. A field no
artifact records is returned as ``null`` and named in ``not_available`` rather
than being filled in, and a value the artifacts leave ambiguous stays ambiguous.

Known divergence from the artifacts, carried over from the Stage 4 audit rather
than reconciled here: ``hours_per_skill`` is role-scoped while ``LEARNING_HOURS``
is flat, and the two disagree for 6 of the 13 shared names. This module reports
the artifact hours and records the conflict; it does not pick a winner.
"""

from collections import defaultdict
from pathlib import Path
from typing import Optional

from . import loaders
from .adapters import (
    UnknownTargetRoleError,
    adapt_signals_for_role,
    artifact_roles,
    build_velocity_profile,
    normalize_role,
    normalize_skill,
    plannable_roles,
)


CURRICULUM_INTELLIGENCE_ARTIFACTS: tuple[str, ...] = (
    "backtest_chart_data.json",
    "cleaned_postings.parquet",
    "dag_structure.json",
    "hours_per_skill.json",
    "proof_b_results.json",
    "proof_c_results.json",
    "proof_e_example.json",
    "skill_scores.parquet",
    "thresholds.json",
    "velocity_scores.parquet",
)

CURRICULUM_INTELLIGENCE_NOT_AVAILABLE: tuple[str, ...] = (
    "university",
    "programme",
    "academic_year",
    "semester",
    "course",
    "credit",
    "curriculum_revision",
    "curriculum_change_over_time",
    "industry_growth_percentage",
    "coverage_percentage",
    "prerequisite_evidence",
)


PROOF_ARTIFACT_SOURCE: dict[str, str] = {
    "external_reference_overlap": "proof_b_results.json",
    "naive_vs_signal_synthetic_benchmark": "proof_c_results.json",
    "budget_sensitivity_example": "proof_e_example.json",
}

SLICE_SEPARATOR = " -> "


def _rows_for_role(rows: list[dict[str, object]], role: str) -> list[dict[str, object]]:
    return [
        row for row in rows if normalize_role(str(row["role_category"])) == role
    ]


def _corpus_block(role: str, *, directory: Optional[Path]) -> dict[str, object]:
    """Corpus bounds from the backtest artifact, plus this role's posting count."""
    bounds = loaders.load_backtest_chart_data(directory=directory)
    role_postings = sum(
        1
        for posting in loaders.load_cleaned_postings(directory=directory)
        if normalize_role(str(posting["role_category"])) == role
    )
    return {
        "artifact": "backtest_chart_data.json",
        "postings_artifact": "cleaned_postings.parquet",
        "dataset_rows": bounds["dataset_rows"],
        "date_min": bounds["date_min"],
        "date_max": bounds["date_max"],
        "usable_slices": list(bounds["usable_slices"]),
        "role_postings": role_postings,
    }


def _velocity_slices(*, directory: Optional[Path]) -> list[str]:
    """The exact ``start -> end`` pairs present in the velocity artifact."""
    pairs = {
        str(row["time_slices_used"])
        for row in loaders.load_velocity_scores(directory=directory)
    }
    return sorted(pairs)


def _resolved_prerequisites(
    role: str, *, directory: Optional[Path]
) -> tuple[dict[str, list[str]], list[dict[str, str]]]:
    """Prerequisite edges the role adapter resolved, keyed by skill.

    A node the DAG records with no prerequisites keeps an empty list; a node the
    DAG does not mention is simply absent. Prerequisite names that no node in
    the role's graph provides are returned separately rather than dropped, so the
    unresolved edge stays visible.
    """
    report = adapt_signals_for_role([], role, directory=directory).divergence_report
    resolved: dict[str, list[str]] = {
        normalize_skill(str(skill)): []
        for skill in report["normalized_artifact_dag"]
    }
    for edge in report["dag_resolved_edges"]:
        resolved.setdefault(normalize_skill(str(edge["skill"])), []).append(
            str(edge["prerequisite"])
        )
    return (
        {skill: sorted(prerequisites) for skill, prerequisites in resolved.items()},
        [dict(edge) for edge in report["dag_dangling_edges"]],
    )


def _role_skill_names(
    role: str,
    *,
    directory: Optional[Path],
    prerequisites: dict[str, list[str]],
) -> set[str]:
    """Union of every skill name the artifacts record for this role."""
    names: set[str] = set(prerequisites)
    for row in loaders.load_skill_scores(directory=directory):
        if normalize_role(str(row["role_category"])) == role:
            names.add(normalize_skill(str(row["skill"])))
    for row in loaders.load_velocity_scores(directory=directory):
        if normalize_role(str(row["role_category"])) == role:
            names.add(normalize_skill(str(row["skill"])))
    for row in loaders.load_hours_per_skill(directory=directory):
        if normalize_role(str(row["role_category"])) == role:
            names.add(normalize_skill(str(row["skill"])))
    return names


def _recorded_slices(time_slices_used: str) -> list[str]:
    """The two half-year observations a stored velocity score compares."""
    baseline, _, latest = time_slices_used.partition(SLICE_SEPARATOR)
    return [baseline, latest]


def _skill_rows(
    role: str,
    *,
    directory: Optional[Path],
    prerequisites: dict[str, list[str]],
) -> list[dict[str, object]]:
    """One record per artifact skill, carrying only recorded values.

    ``slices`` holds exactly the two observations the stored velocity score was
    computed from, not the whole four-slice inventory: the artifact records a
    score for one baseline-to-latest pair, and a longer series would imply
    measurements the velocity artifact never made. The full inventory is served
    once at corpus level as ``usable_slices``.
    """
    scores = {
        normalize_skill(str(row["skill"])): row
        for row in _rows_for_role(
            loaders.load_skill_scores(directory=directory), role
        )
    }
    velocities = {
        normalize_skill(str(row["skill"])): row
        for row in _rows_for_role(
            loaders.load_velocity_scores(directory=directory), role
        )
    }
    hours = {
        normalize_skill(str(row["skill"])): row
        for row in _rows_for_role(
            loaders.load_hours_per_skill(directory=directory), role
        )
    }

    profile = build_velocity_profile(directory=directory)
    if profile["status"] == "pass":
        history: dict[str, dict[str, dict[str, object]]] = defaultdict(dict)
        for row in profile["history"]:
            if row["role_category"] == role:
                history[str(row["skill"])][str(row["time_slice"])] = {
                    "time_slice": row["time_slice"],
                    "mentions": row["mentions"],
                    "total_postings": row["total_postings"],
                    "frequency": row["frequency"],
                }
        changes = {
            str(row["skill"]): row
            for row in profile["summaries"]
            if row["role_category"] == role
        }
    else:
        history = {}
        changes = {}

    rows: list[dict[str, object]] = []
    for skill in sorted(
        _role_skill_names(
            role, directory=directory, prerequisites=prerequisites
        )
    ):
        score = scores.get(skill)
        velocity = velocities.get(skill)
        hour = hours.get(skill)
        change = changes.get(skill)

        slices = None
        if velocity is not None:
            slices = [
                history[skill][slice_id]
                for slice_id in _recorded_slices(
                    str(velocity["time_slices_used"])
                )
                if slice_id in history.get(skill, {})
            ] or None

        rows.append(
            {
                "skill": skill,
                "frequency": None if score is None else score["frequency"],
                "classification": None if score is None else score["classification"],
                "velocity_score": (
                    None if velocity is None else velocity["velocity_score"]
                ),
                "time_slices_used": (
                    None if velocity is None else str(velocity["time_slices_used"])
                ),
                "slices": slices,
                "absolute_change": (
                    None if change is None else change["absolute_change"]
                ),
                "percentage_change": (
                    None if change is None else change["percentage_change"]
                ),
                "hours": None if hour is None else hour["hours"],
                "hours_source": None if hour is None else str(hour["source"]),
                "prerequisites": prerequisites.get(skill),
            }
        )

    rows.sort(key=lambda row: (-(row["frequency"] or 0.0), str(row["skill"])))
    return rows


def _evidence(role: str, *, directory: Optional[Path]) -> list[dict[str, object]]:
    """Proof records for this role, or role-agnostic ones, caveats intact.

    The embedded raw artifact dump is dropped because ``/proofs`` already serves
    it; the file that produced each record is named instead.
    """
    from .proofs import normalize_proofs

    records = []
    for record in normalize_proofs(directory=directory):
        if record["role_category"] not in (None, role):
            continue
        published = {key: value for key, value in record.items() if key != "artifact"}
        published["artifact_source"] = PROOF_ARTIFACT_SOURCE.get(
            str(record["proof_type"])
        )
        records.append(published)
    return records


def build_role_curriculum_intelligence(
    role: str, *, directory: Optional[Path] = None
) -> dict[str, object]:
    """Assemble the artifact-backed record for one role category.

    A role the artifacts know but that has no hours or prerequisite graph is
    still answered, with ``plannable: false`` and its learning fields left null,
    because a corpus-only role is a real recorded state rather than an error.
    A role the artifacts do not know raises :class:`UnknownTargetRoleError`.
    """
    normalized = normalize_role(role)
    known = artifact_roles(directory=directory)
    if normalized not in known:
        raise UnknownTargetRoleError(normalized, known)

    plannable = normalized in plannable_roles(directory=directory)
    prerequisites, dangling = (
        _resolved_prerequisites(normalized, directory=directory)
        if plannable
        else ({}, [])
    )
    profile = build_velocity_profile(directory=directory)

    return {
        "role_category": normalized,
        "plannable": plannable,
        "known_roles": known,
        "plannable_roles": plannable_roles(directory=directory),
        "corpus": _corpus_block(normalized, directory=directory),
        "thresholds": {
            "artifact": "thresholds.json",
            **loaders.load_thresholds(directory=directory),
        },
        "velocity_slices": _velocity_slices(directory=directory),
        "velocity_reproducibility": {
            "status": profile["status"],
            "checked_scores": profile["checked_scores"],
            "matched_scores": profile["matched_scores"],
            "tolerance": profile["tolerance"],
        },
        "dangling_prerequisites": dangling,
        "skills": _skill_rows(
            normalized, directory=directory, prerequisites=prerequisites
        ),
        "evidence": _evidence(normalized, directory=directory),
        "artifacts": list(CURRICULUM_INTELLIGENCE_ARTIFACTS),
        "not_available": list(CURRICULUM_INTELLIGENCE_NOT_AVAILABLE),
    }
