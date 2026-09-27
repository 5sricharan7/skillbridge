from backend.data.proofs import normalize_proofs


def test_proof_ids_and_order_are_stable() -> None:
    first = normalize_proofs()
    second = normalize_proofs()

    assert first == second
    assert [proof["proof_id"] for proof in first] == [
        "proof-b-backend_ml_engineer",
        "proof-b-data_science",
        "proof-b-other",
        "proof-c-synthetic-benchmark",
        "proof-e-budget-sensitivity-backend_ml_engineer",
    ]


def test_proof_b_keeps_exact_role_scoped_overlap_values_and_skill_rows() -> None:
    proofs = {
        proof["role_category"]: proof
        for proof in normalize_proofs()
        if proof["proof_id"].startswith("proof-b-")
    }

    assert set(proofs) == {"backend_ml_engineer", "data_science", "other"}
    assert proofs["backend_ml_engineer"]["metrics"]["overlap_pct"] == 0.0
    assert proofs["data_science"]["metrics"]["overlap_pct"] == 66.66666666666667
    assert proofs["other"]["metrics"]["overlap_pct"] == 0.0
    for role, proof in proofs.items():
        assert proof["source_urls"] == [
            "https://community.nasscom.in/communities/data-science-ai-community/state-data-science-ai-skills-india",
            "https://community.nasscom.in/communities/talent-skills/reskilling-relevance-how-ai-redefining-it-skill-landscape",
        ]
        assert all(
            item["role_category"] == role
            for item in proof["metrics"]["skill_results"]
        )
        assert proof["artifact"]["reference_urls"] == proof["source_urls"]
        assert proof["sample_size"] == proof["metrics"]["top10_count"]


def test_proof_c_is_synthetic_and_preserves_warning_and_sample_size() -> None:
    proof = next(
        proof
        for proof in normalize_proofs()
        if proof["proof_id"] == "proof-c-synthetic-benchmark"
    )

    assert proof["is_synthetic"] is True
    assert proof["sample_size"] == 20
    assert proof["caveats"] == [
        "Not a production precision estimate; cases are derived from the current skill vocabulary."
    ]
    assert proof["caveats"][0] in proof["artifact"]["warning"]
    assert len(proof["metrics"]["cases"]) == 20


def test_proof_e_states_that_identical_plans_do_not_show_budget_sensitivity() -> None:
    proof = next(
        proof
        for proof in normalize_proofs()
        if proof["proof_id"].startswith("proof-e-")
    )

    assert proof["metrics"]["plan_20_hours"] == ["java"]
    assert proof["metrics"]["plan_100_hours"] == ["java"]
    assert proof["metrics"]["plans_identical"] is True
    assert proof["metrics"]["demonstrates_budget_sensitivity"] is False
    assert proof["is_synthetic"] is True
    assert any(
        "20h and 100h plans were identical" in caveat
        and "does not demonstrate budget sensitivity" in caveat
        for caveat in proof["caveats"]
    )


def test_proof_normalization_excludes_backtest_and_invented_proof_a() -> None:
    proofs = normalize_proofs()
    ids = {proof["proof_id"] for proof in proofs}

    assert all("backtest" not in proof_id for proof_id in ids)
    assert not any(proof_id.startswith("proof-a-") for proof_id in ids)
    assert all(
        set(proof)
        == {
            "proof_id",
            "proof_type",
            "role_category",
            "source",
            "source_urls",
            "metrics",
            "caveats",
            "is_synthetic",
            "sample_size",
            "artifact",
        }
        for proof in proofs
    )


def test_returned_proof_artifacts_are_not_shared_between_calls() -> None:
    first = normalize_proofs()
    first[0]["artifact"]["results"][0]["frequency"] = -1
    second = normalize_proofs()

    assert second[0]["artifact"]["results"][0]["frequency"] >= 0
