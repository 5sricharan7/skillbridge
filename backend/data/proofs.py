"""Stable, provenance-preserving proof records built from finalized artifacts."""

from copy import deepcopy
from typing import Optional

from . import loaders


def normalize_proofs(*, directory=None) -> list[dict[str, object]]:
    """Normalize Proof B, C, and E without pooling roles or altering source data."""
    proof_b = loaders.load_proof_b_results(directory=directory)
    proof_c = loaders.load_proof_c_results(directory=directory)
    proof_e = loaders.load_proof_e_example(directory=directory)

    proofs = _normalize_proof_b(proof_b)
    proofs.append(_normalize_proof_c(proof_c))
    proofs.extend(_normalize_proof_e(proof_e))
    return proofs


def _normalize_proof_b(artifact: dict[str, object]) -> list[dict[str, object]]:
    role_summaries = {
        str(summary["role_category"]): summary
        for summary in artifact["summary"]
    }
    results_by_role: dict[str, list[dict[str, object]]] = {}
    for result in artifact["results"]:
        role = str(result["role_category"])
        results_by_role.setdefault(role, []).append(deepcopy(result))

    records = []
    for role in sorted(set(role_summaries) | set(results_by_role)):
        summary = deepcopy(role_summaries.get(role))
        role_results = results_by_role.get(role, [])
        overlap_pct: Optional[object] = (
            None if summary is None else summary.get("overlap_pct")
        )
        records.append(
            {
                "proof_id": f"proof-b-{role}",
                "proof_type": "external_reference_overlap",
                "role_category": role,
                "source": artifact["reference_description"],
                "source_urls": list(artifact["reference_urls"]),
                "metrics": {
                    "overlap_pct": overlap_pct,
                    "top10_count": None
                    if summary is None
                    else summary.get("top10_count"),
                    "matched": None if summary is None else summary.get("matched"),
                    "skill_results": role_results,
                },
                "caveats": [
                    "Reference overlap is role-scoped; absence from a selected "
                    "reference set is not evidence that a skill is unimportant."
                ],
                "is_synthetic": False,
                "sample_size": None if summary is None else summary.get("top10_count"),
                "artifact": deepcopy(artifact),
            }
        )
    return records


def _normalize_proof_c(artifact: dict[str, object]) -> dict[str, object]:
    warning = str(artifact["warning"])
    caveats = [warning]
    return {
        "proof_id": "proof-c-synthetic-benchmark",
        "proof_type": "naive_vs_signal_synthetic_benchmark",
        "role_category": None,
        "source": str(artifact["benchmark_type"]),
        "source_urls": [],
        "metrics": {
            "naive": deepcopy(artifact["naive"]),
            "signal_engine": deepcopy(artifact["signal_engine"]),
            "cases": deepcopy(artifact["cases"]),
        },
        "caveats": caveats,
        "is_synthetic": True,
        "sample_size": artifact["n_cases"],
        "artifact": deepcopy(artifact),
    }


def _normalize_proof_e(artifact: dict[str, object]) -> list[dict[str, object]]:
    records = []
    for role, example in sorted(artifact.items()):
        plan_20 = deepcopy(example["20_hours"])
        plan_100 = deepcopy(example["100_hours"])
        plans_identical = plan_20 == plan_100
        caveats = ["Illustrative example output, not a production outcome."]
        if plans_identical:
            caveats.append(
                "The recorded 20h and 100h plans were identical; this example "
                "does not demonstrate budget sensitivity."
            )
        records.append(
            {
                "proof_id": f"proof-e-budget-sensitivity-{role}",
                "proof_type": "budget_sensitivity_example",
                "role_category": role,
                "source": "Notebook 4 budget-sensitivity example",
                "source_urls": [],
                "metrics": {
                    "plan_20_hours": plan_20,
                    "plan_100_hours": plan_100,
                    "plans_identical": plans_identical,
                    "different_plan": example["different_plan"],
                    "reprioritized": example["reprioritized"],
                    "demonstrates_budget_sensitivity": not plans_identical,
                },
                "caveats": caveats,
                "is_synthetic": True,
                "sample_size": None,
                "artifact": deepcopy(artifact),
            }
        )
    return records
