"""Stage 14A — the model-internal gap-closure delta, and what it refuses.

Two kinds of assertion live here.

The **measurement** assertions are written against the signal engine itself rather
than against hand-written scores. The expected magnitude is read from
``signal_engine._GAP_WEIGHT``, so a change to the engine's weighting fails these
tests instead of passing them on a stale ``0.4``. The closure cases are produced by
running the engine over a real BEFORE resume text and a real AFTER resume text, so
what is measured is the engine's own behaviour and not a fixture invented here.

The **refusal** assertions cover what must never happen: a delta whose direction or
size is assumed instead of measured, a closure read from a record whose ``gap`` and
``in_resume`` flags contradict each other, a score silently defaulted so a delta can
still be produced, two skills collapsed onto one result, an input mutated, or a
figure this repository cannot support returned under a plausible name.
"""

from copy import deepcopy

import pytest

from backend.data import calibration
from backend.data.calibration import (
    CALIBRATION_NOT_AVAILABLE,
    GAP_WEIGHT,
    NOT_AVAILABLE,
    OBSERVED_NOT_AVAILABLE_NOTE,
    OBSERVED_SOURCE_MEASURED_OUTCOME,
    CalibrationInputError,
    calibrate_gap_closure,
    calibrate_gap_closures,
    model_internal_consistency_error,
    prediction_error,
)
from backend.engines import signal_engine
from backend.engines.signal_engine import compute_skill_signals


JD = "Python Python SQL SQL"


def signals(resume_text: str = "") -> list[dict[str, object]]:
    """A real result from the engine: the same call ``POST /roadmap`` makes."""
    return list(compute_skill_signals(resume_text, JD))


def signal_for(result, skill):
    """One engine row, for asserting against rather than for reading back in."""
    return next(row for row in result if row["skill"] == skill)


# --------------------------------------------------------------- 0. weight source


def test_gap_weight_is_the_signal_engines_constant() -> None:
    """The calibration weight is the engine's, not a second copy of its number."""
    assert GAP_WEIGHT == signal_engine._GAP_WEIGHT
    assert GAP_WEIGHT == pytest.approx(0.4)


def test_module_exposes_a_calibrator_and_no_second_scorer() -> None:
    """One formula, and it is the engine's: nothing here recomputes a score."""
    assert set(calibration.__all__) == {
        "CALIBRATION_NOT_AVAILABLE",
        "GAP_WEIGHT",
        "NOT_AVAILABLE",
        "OBSERVED_NOT_AVAILABLE_NOTE",
        "OBSERVED_SOURCE_MEASURED_OUTCOME",
        "SCORE_PRECISION",
        "CalibrationInputError",
        "calibrate_gap_closure",
        "calibrate_gap_closures",
        "model_internal_consistency_error",
        "prediction_error",
    }
    # The engine rounds its own scores to two decimals, and the delta is reported at
    # the same precision so the measured weight is 0.4 and not 0.40000000000000002.
    assert calibration.SCORE_PRECISION == 2


def test_a_genuine_closure_moves_the_score_by_exactly_the_gap_weight() -> None:
    """Requirement 1 — a real single gap closure is the engine's gap weight."""
    result = calibrate_gap_closure(signals(), signals("Python"), "python")

    assert result["skill"] == "python"
    assert result["gap_closed"] is True
    assert result["before_gap"] is True
    assert result["after_gap"] is False
    assert result["abs_delta"] == signal_engine._GAP_WEIGHT
    assert result["predicted_gain"] == signal_engine._GAP_WEIGHT
    assert result["matches_predicted_gain"] is True


def test_closure_delta_is_exactly_minus_the_weight_not_float_noise() -> None:
    """The signed delta is the engine weight, not ``-0.40000000000000002``."""
    result = calibrate_gap_closure(signals(), signals("Python"), "python")

    assert result["delta"] == -GAP_WEIGHT


# --------------------------------------------------------------- 1. no gap closed


def test_no_gap_closure_reports_no_predicted_gain() -> None:
    """Requirement 2 — a skill already present before and after claims no gain."""
    result = calibrate_gap_closure(signals("Python SQL"), signals("Python SQL"), "python")

    assert result["before_gap"] is False
    assert result["after_gap"] is False
    assert result["gap_closed"] is False
    assert result["predicted_gain"] == 0.0
    assert result["delta"] == 0.0
    assert result["abs_delta"] == 0.0
    assert result["matches_predicted_gain"] is False


def test_an_unrelated_skill_is_unchanged_by_another_skills_closure() -> None:
    """Requirement 3 — closing Python leaves SQL exactly where it was."""
    before = signals()
    after = signals("Python")
    result = calibrate_gap_closure(before, after, "sql")

    assert result["gap_closed"] is False
    assert result["predicted_gain"] == 0.0
    assert result["before_score"] == signal_for(before, "sql")["signal_score"]
    assert result["after_score"] == signal_for(after, "sql")["signal_score"]
    assert result["delta"] == 0.0


def test_a_gap_that_opens_is_not_reported_as_a_closure() -> None:
    """A reversed pair is measured honestly: positive delta, no closure."""
    result = calibrate_gap_closure(signals("Python"), signals(), "python")

    assert result["gap_closed"] is False
    assert result["delta"] == GAP_WEIGHT
    assert result["abs_delta"] == GAP_WEIGHT
    assert result["predicted_gain"] == 0.0


# ------------------------------------------------------- 2. scores kept verbatim


def test_before_and_after_scores_are_preserved_exactly() -> None:
    """Requirement 4 — both scores are the engine's own values, unchanged."""
    before = signals()
    after = signals("Python")
    result = calibrate_gap_closure(before, after, "python")

    assert result["before_score"] == signal_for(before, "python")["signal_score"] == 0.64
    assert result["after_score"] == signal_for(after, "python")["signal_score"] == 0.24


def test_scores_survive_a_result_carrying_extra_engine_fields() -> None:
    """Adapter and optimizer fields on the same row do not disturb the read."""
    before = [{**row, "estimated_hours": 12, "trend": "rising"} for row in signals()]
    after = [{**row, "estimated_hours": 12} for row in signals("Python")]

    result = calibrate_gap_closure(before, after, "python")

    assert result["before_score"] == 0.64
    assert result["after_score"] == 0.24
    assert result["abs_delta"] == GAP_WEIGHT


# ------------------------------------------------- 3. delta measured, not assumed


def test_signed_delta_is_calculated_from_the_actual_scores() -> None:
    """Requirement 5 — a flip with a changed frequency reports its own number."""
    before = [{"skill": "python", "in_resume": False, "gap": True, "signal_score": 0.64}]
    after = [{"skill": "python", "in_resume": True, "gap": False, "signal_score": 0.48}]

    result = calibrate_gap_closure(before, after, "python")

    assert result["gap_closed"] is True
    assert result["delta"] == pytest.approx(-0.16)
    assert result["abs_delta"] == pytest.approx(0.16)
    assert result["predicted_gain"] == GAP_WEIGHT
    assert result["matches_predicted_gain"] is False


def test_a_matching_closure_is_the_only_case_predicted_gain_is_claimed() -> None:
    """predicted_gain follows the gap flags, not the size of the delta."""
    before = [{"skill": "python", "gap": True, "signal_score": 0.9}]
    after = [{"skill": "python", "gap": False, "signal_score": 0.6}]

    result = calibrate_gap_closure(before, after, "python")

    assert result["gap_closed"] is True
    assert result["delta"] == pytest.approx(-0.3)
    assert result["predicted_gain"] == GAP_WEIGHT
    assert result["matches_predicted_gain"] is False


def test_a_closure_that_matches_the_weight_is_reported_as_matching() -> None:
    """When the measured delta is the engine's term, the row says so."""
    before = [{"skill": "python", "gap": True, "signal_score": 1.0}]
    after = [{"skill": "python", "gap": False, "signal_score": 0.6}]

    result = calibrate_gap_closure(before, after, "python")

    assert result["matches_predicted_gain"] is True
    assert result["abs_delta"] == GAP_WEIGHT


# ------------------------------------------------------------- 4. provenance


def test_provenance_is_present_on_every_result() -> None:
    """Requirement 6 — each row carries its own statement of what it measured."""
    single = calibrate_gap_closure(signals(), signals("Python"), "python")
    batch = calibrate_gap_closures(signals(), signals("Python SQL"))

    assert single["provenance"]["measure"] == "model_internal_gap_closure_delta"
    assert single["provenance"]["engine"] == "backend.engines.signal_engine"
    assert single["provenance"]["gap_weight"] == signal_engine._GAP_WEIGHT
    assert all(row["provenance"] for row in batch["skills"])


def test_provenance_names_the_figures_it_is_not() -> None:
    """The refusals travel with the figure rather than living in a comment."""
    result = calibrate_gap_closure(signals(), signals("Python"), "python")
    provenance = result["provenance"]

    for refused in (
        "actual_learner_gain",
        "hiring_probability",
        "placement_probability",
        "prediction_accuracy",
        "verified_completion",
    ):
        assert refused in provenance["not_a_measure_of"]


def test_provenance_claims_no_outcome_in_its_own_wording() -> None:
    """No provenance field describes the delta as employability or a hire."""
    result = calibrate_gap_closure(signals(), signals("Python"), "python")
    wording = " ".join(
        value
        for value in result["provenance"].values()
        if isinstance(value, str)
    ).casefold()

    for claim in ("employab", "hiring", "placement", "probabilit", "learner outcome"):
        assert claim not in wording


def test_no_result_carries_a_refused_figure() -> None:
    """No outcome, accuracy, or completion figure is claimed anywhere."""
    batch = calibrate_gap_closures(signals(), signals("Python SQL"))
    single = calibrate_gap_closure(signals(), signals("Python"), "python")

    assert batch["not_available"] == list(CALIBRATION_NOT_AVAILABLE)
    for name in (
        "actual_learner_gain",
        "observed_gain",
        "prediction_accuracy",
        "mae",
        "rmse",
        "calibration_statistics",
        "verified_completion",
    ):
        assert name in batch["not_available"]
    for row in [single, *batch["skills"]]:
        assert set(row).isdisjoint(CALIBRATION_NOT_AVAILABLE)
        assert set(row["provenance"]["not_a_measure_of"]) == set(CALIBRATION_NOT_AVAILABLE)


def test_method_note_describes_the_measurement_as_internal() -> None:
    """The batch wording names the figure as an engine score change only."""
    note = calibration.METHOD_NOTE.casefold()

    assert "not an employability gain" in note
    assert "no before/after pair is retained after the call returns" in note


# --------------------------------------------------------- 5. not synthetic


def test_results_are_not_synthetic() -> None:
    """Requirement 7 — the figure is arithmetic, so it is never synthetic."""
    single = calibrate_gap_closure(signals(), signals("Python"), "python")
    batch = calibrate_gap_closures(signals(), signals("Python SQL"))

    assert single["is_synthetic"] is False
    assert batch["is_synthetic"] is False
    assert all(row["is_synthetic"] is False for row in batch["skills"])


def test_module_produces_no_simulated_or_sampled_figure() -> None:
    """Nothing here generates data: the supplied pair is the only input."""
    text = open(calibration.__file__, encoding="utf-8").read()

    assert "random" not in text
    assert "SYNTHETIC_SCENARIO" not in text
    assert "is_synthetic" in text


# ------------------------------------------------------------ 6. clean rejection


@pytest.mark.parametrize("skill", ["rust", "   ", 7, None, ["python"]])
def test_missing_or_invalid_skill_is_rejected(skill) -> None:
    """Requirement 8 — an unusable skill is refused, never guessed."""
    with pytest.raises(CalibrationInputError):
        calibrate_gap_closure(signals(), signals("Python"), skill)


def test_a_skill_missing_from_the_after_result_is_rejected() -> None:
    """There is no after_score to subtract, so no delta is invented."""
    python_only = list(compute_skill_signals("", "Python"))
    sql_only = list(compute_skill_signals("", "SQL"))

    with pytest.raises(CalibrationInputError, match="after has no signal"):
        calibrate_gap_closure(python_only, sql_only, "python")


def test_a_skill_missing_from_the_before_result_is_rejected() -> None:
    """There is no before_score to subtract, so no delta is invented."""
    python_only = list(compute_skill_signals("", "Python"))
    sql_only = list(compute_skill_signals("", "SQL"))

    with pytest.raises(CalibrationInputError, match="before has no signal"):
        calibrate_gap_closure(python_only, sql_only, "sql")


@pytest.mark.parametrize(
    "broken",
    [
        [{"skill": "python", "gap": True}],
        [{"skill": "python", "gap": True, "signal_score": "0.64"}],
        [{"skill": "python", "gap": True, "signal_score": True}],
        [{"skill": "python", "gap": True, "signal_score": float("nan")}],
        [{"skill": "python", "gap": "yes", "signal_score": 0.64}],
        [{"skill": "python", "gap": True, "in_resume": True, "signal_score": 0.64}],
        [{"skill": "   ", "gap": True, "signal_score": 0.64}],
        [{"gap": True, "signal_score": 0.64}],
        ["python"],
        [{"skill": "python", "gap": True, "signal_score": 0.64}, "python"],
        "python",
        {"roadmap": [{"skill": "python", "hours": 12}]},
    ],
)
def test_an_unreadable_before_result_is_rejected(broken) -> None:
    """A missing, mistyped, or self-contradictory signal is refused, not defaulted."""
    with pytest.raises(CalibrationInputError):
        calibrate_gap_closure(broken, signals("Python"), "python")


@pytest.mark.parametrize(
    "broken",
    [
        [{"skill": "python", "in_resume": False, "gap": False, "signal_score": 0.4}],
        [{"skill": "python", "gap": False}],
    ],
)
def test_an_unreadable_after_result_is_rejected(broken) -> None:
    """The AFTER side is held to the same reading rules as the BEFORE side."""
    with pytest.raises(CalibrationInputError):
        calibrate_gap_closure(signals(), broken, "python")


def test_the_error_names_the_offending_skill() -> None:
    """Rejection carries the skill, so a caller can find the row to fix."""
    broken = [
        {"skill": "python", "gap": True, "signal_score": 0.64},
        {"skill": "sql", "gap": True},
    ]

    with pytest.raises(CalibrationInputError) as error:
        calibrate_gap_closure(broken, signals("Python SQL"), "sql")

    assert "before['sql'].signal_score" in str(error.value)


def test_a_duplicate_skill_on_one_side_is_refused_not_merged() -> None:
    """Two scores for one skill are ambiguous and must not collapse to one."""
    duplicated = [
        {"skill": "python", "gap": True, "signal_score": 0.64},
        {"skill": "Python", "gap": True, "signal_score": 0.52},
    ]

    with pytest.raises(CalibrationInputError, match="more than once"):
        calibrate_gap_closure(duplicated, signals("Python"), "python")


# ---------------------------------------------------- 7. one row per skill


def test_multiple_closures_do_not_collapse_into_one_result() -> None:
    """Requirement 9 — two closed gaps are two results with their own scores."""
    payload = calibrate_gap_closures(signals(), signals("Python SQL"))
    rows = payload["skills"]

    assert len(rows) == 2
    assert [row["skill"] for row in rows] == ["python", "sql"]
    assert payload["gap_closures"] == 2
    for row in rows:
        assert row["gap_closed"] is True
        assert row["before_score"] == 0.64
        assert row["after_score"] == 0.24
        assert row["abs_delta"] == GAP_WEIGHT
    assert rows[0] is not rows[1]
    assert rows[0]["provenance"] is not rows[1]["provenance"]


def test_two_skills_closing_at_the_same_weight_stay_separate_results() -> None:
    """Equal magnitudes must not be reported as one shared delta."""
    before = [
        {"skill": "sql", "gap": True, "signal_score": 0.9},
        {"skill": "python", "gap": True, "signal_score": 0.9},
    ]
    after = [
        {"skill": "sql", "gap": False, "signal_score": 0.5},
        {"skill": "python", "gap": False, "signal_score": 0.5},
    ]

    rows = calibrate_gap_closures(before, after)["skills"]

    assert len(rows) == 2
    assert all(row["abs_delta"] == GAP_WEIGHT for row in rows)
    assert [row["skill"] for row in rows] == ["python", "sql"]


def test_a_batch_reports_each_skill_independently() -> None:
    """One closed gap and one untouched gap do not merge into one verdict."""
    payload = calibrate_gap_closures(signals(), signals("Python"))
    rows = {row["skill"]: row for row in payload["skills"]}

    assert payload["gap_closures"] == 1
    assert rows["python"]["gap_closed"] is True
    assert rows["python"]["predicted_gain"] == GAP_WEIGHT
    assert rows["sql"]["gap_closed"] is False
    assert rows["sql"]["predicted_gain"] == 0.0
    assert rows["sql"]["delta"] == 0.0


def test_a_skill_on_one_side_only_is_listed_rather_than_dropped() -> None:
    """No delta exists for it, so it is reported instead of scored as zero."""
    before = signals()
    after = [row for row in signals("Python SQL") if row["skill"] != "sql"]

    payload = calibrate_gap_closures(before, after)

    assert [row["skill"] for row in payload["skills"]] == ["python"]
    assert payload["unpaired_skills"]["missing_from_after"] == ["sql"]
    assert payload["unpaired_skills"]["missing_from_before"] == []


def test_rows_are_ordered_by_magnitude_then_alphabetically() -> None:
    """Ordering is deterministic, so two runs of a pair read the same way."""
    pair = (
        [
            {"skill": "sql", "gap": True, "signal_score": 0.9},
            {"skill": "python", "gap": True, "signal_score": 0.9},
        ],
        [
            {"skill": "sql", "gap": False, "signal_score": 0.3},
            {"skill": "python", "gap": False, "signal_score": 0.5},
        ],
    )

    payload = calibrate_gap_closures(*pair)

    assert [row["skill"] for row in payload["skills"]] == ["sql", "python"]
    assert payload == calibrate_gap_closures(*pair)


# ------------------------------------------------------------ 8. inputs untouched


def test_inputs_are_not_mutated() -> None:
    """Requirement 10 — the caller's results come back exactly as supplied."""
    before = signals()
    after = signals("Python")
    before_snapshot = deepcopy(before)
    after_snapshot = deepcopy(after)

    calibrate_gap_closure(before, after, "python")
    calibrate_gap_closures(before, after)

    assert before == before_snapshot
    assert after == after_snapshot


def test_returned_rows_are_not_aliased_to_the_inputs() -> None:
    """A consumer editing a result cannot reach back into the input rows."""
    before = signals()
    after = signals("Python")

    row = calibrate_gap_closure(before, after, "python")
    row["provenance"]["basis"] = "edited"
    row["skill"] = "edited"

    assert before[0] == signal_for(before, "python")
    assert calibrate_gap_closure(before, after, "python")["provenance"]["basis"] != "edited"


# ------------------------------------------------------------ 9. accepted inputs


def test_skill_matching_uses_the_existing_normalization() -> None:
    """Casing and spacing never decide whether a result is found."""
    result = calibrate_gap_closure(signals(), signals("Python"), "  PYTHON ")

    assert result["skill"] == "python"
    assert result["abs_delta"] == GAP_WEIGHT


@pytest.mark.parametrize("wrap", [list, tuple, lambda rows: {"signals": rows}])
def test_a_result_may_arrive_in_any_supported_shape(wrap) -> None:
    """The engine's list, a tuple, and a wrapped result all read the same."""
    result = calibrate_gap_closure(wrap(signals()), wrap(signals("Python")), "python")

    assert result["abs_delta"] == GAP_WEIGHT


def test_a_single_signal_mapping_is_a_valid_result() -> None:
    """One skill's signal on each side is enough to measure it."""
    before = {"skill": "python", "in_resume": False, "gap": True, "signal_score": 0.64}
    after = {"skill": "python", "in_resume": True, "gap": False, "signal_score": 0.24}

    result = calibrate_gap_closure(before, after, "python")

    assert result["gap_closed"] is True
    assert result["abs_delta"] == GAP_WEIGHT


def test_a_record_without_in_resume_is_read_from_its_gap_flag() -> None:
    """``in_resume`` is the engine's convenience field, not a requirement here."""
    before = [{"skill": "python", "gap": True, "signal_score": 0.64}]
    after = [{"skill": "python", "gap": False, "signal_score": 0.24}]

    result = calibrate_gap_closure(before, after, "python")

    assert result["gap_closed"] is True
    assert result["delta"] == -GAP_WEIGHT


def test_roadmap_rows_are_refused_because_they_carry_no_score() -> None:
    """Roadmap rows have no signal_score, so they are refused, not estimated."""
    roadmap = {"budget_hours": 40, "roadmap": [{"skill": "python", "hours": 12}]}

    with pytest.raises(CalibrationInputError):
        calibrate_gap_closure(roadmap, roadmap, "python")


# =============================================================================
# Stage 14D — validation arithmetic
# =============================================================================
#
# Two halves, deliberately kept apart. The model-internal half is real arithmetic
# over results this repository holds, so it is computed and asserted to exact
# values. The observed half has no input at all, so it is asserted to be
# *unavailable* — never zero, never absent, never silently dropped.
#
# The refusal assertions are the substance of this stage. There is no legitimate
# observed learner score anywhere in this repository, and the arithmetic below is
# one careless argument away from producing one.

MEASURED = OBSERVED_SOURCE_MEASURED_OUTCOME


def closure_result():
    """A real engine closure: the same call ``POST /roadmap`` makes, twice."""
    return calibrate_gap_closure(signals(), signals("Python"), "python")


def no_closure_result():
    """The same skill, already present on both sides."""
    return calibrate_gap_closure(signals("Python SQL"), signals("Python SQL"), "python")


# ------------------------------------------------- 14D.1 consistency == zero


def test_14d_01_a_genuine_closure_is_perfectly_self_consistent() -> None:
    """Requirement 1 — expected 0.4, measured 0.4, error 0."""
    result = closure_result()
    validation = result["validation"]

    assert validation["model_internal_expected_gain"] == 0.4
    assert validation["model_internal_measured_magnitude"] == 0.4
    assert validation["model_internal_consistency_error"] == 0.0
    assert validation["is_consistent"] is True
    # Also on the row itself, so a caller holding one row need not recompute it.
    assert result["model_internal_consistency_error"] == 0.0


def test_14d_02_no_gap_closure_is_also_consistent_at_zero() -> None:
    """Requirement 2 — expected 0, measured 0, error 0. Nothing expected, nothing missed."""
    result = no_closure_result()
    validation = result["validation"]

    assert result["gap_closed"] is False
    assert result["predicted_gain"] == 0.0
    assert validation["model_internal_expected_gain"] == 0.0
    assert validation["model_internal_measured_magnitude"] == 0.0
    assert validation["model_internal_consistency_error"] == 0.0


def test_14d_03_the_signed_delta_is_preserved_alongside_the_magnitude() -> None:
    """Requirement 3 — the sign is information the magnitude throws away."""
    result = closure_result()
    validation = result["validation"]

    assert result["delta"] == -0.4
    assert validation["model_internal_delta"] == -0.4
    assert validation["model_internal_measured_magnitude"] == 0.4


def test_14d_04_the_absolute_model_delta_is_the_magnitude_of_the_signed_one() -> None:
    """Requirement 4 — abs(after - before), and a gap that opens keeps its sign."""
    closing = closure_result()
    opening = calibrate_gap_closure(signals("Python"), signals(), "python")

    assert closing["validation"]["model_internal_measured_magnitude"] == abs(
        closing["delta"]
    )
    # A gap that opens is not a closure: nothing was expected, and the measured
    # magnitude is reported against an expectation of zero rather than hidden.
    assert opening["gap_closed"] is False
    assert opening["delta"] == 0.4
    assert opening["validation"]["model_internal_delta"] == 0.4
    assert opening["validation"]["model_internal_measured_magnitude"] == 0.4
    assert opening["validation"]["model_internal_consistency_error"] == 0.4
    assert opening["validation"]["is_consistent"] is False


def test_14d_05_a_closure_that_does_not_match_the_model_is_reported_as_inconsistent() -> None:
    """The check earns its name by failing when the results disagree with the model."""
    before = [{"skill": "python", "gap": True, "signal_score": 0.64}]
    after = [{"skill": "python", "gap": False, "signal_score": 0.48}]

    result = calibrate_gap_closure(before, after, "python")

    assert result["gap_closed"] is True
    assert result["validation"]["model_internal_consistency_error"] == 0.24
    assert result["validation"]["is_consistent"] is False


# ------------------------------------------------------- 14D.2 prediction error


def test_14d_06_prediction_error_works_when_an_observed_gain_is_supplied() -> None:
    """Requirement 5 — the arithmetic, once a real observed source is declared."""
    result = prediction_error(
        predicted_gain=0.4,
        observed_gain=0.25,
        observed_source=MEASURED,
    )

    assert result["predicted_gain"] == 0.4
    assert result["observed_gain"] == 0.25
    assert result["observed_source"] == MEASURED
    assert result["prediction_error"] == pytest.approx(0.15)
    assert result["status"] == "measured"


def test_14d_07_prediction_error_is_not_generated_without_an_observed_gain() -> None:
    """Requirement 6 — no observed gain means no error figure, in any spelling."""
    result = prediction_error(predicted_gain=0.4)

    assert result["prediction_error"] == NOT_AVAILABLE
    assert result["observed_gain"] == NOT_AVAILABLE
    assert result["observed_source"] == NOT_AVAILABLE
    assert result["status"] == NOT_AVAILABLE
    assert "nothing to compare" in result["reason"]


def test_14d_07b_an_undeclared_number_is_not_an_observation() -> None:
    """A bare gain with no instrument is refused: nothing measured it."""
    result = prediction_error(predicted_gain=0.4, observed_gain=0.25)

    assert result["prediction_error"] == NOT_AVAILABLE
    assert result["observed_gain"] == NOT_AVAILABLE
    assert result["reason"].startswith("an observed gain was supplied without declaring")


@pytest.mark.parametrize(
    "source",
    [
        "learner_asserted",
        "self_reported",
        "after_score",
        "model_internal",
        "model_internal_delta",
        "predicted_gain",
        "  ",
        None,
        7,
        True,
    ],
)
def test_14d_08_no_non_observed_source_is_accepted_as_the_observed_side(source) -> None:
    """Requirements 7 and 8 — the plausible wrong values are all refused."""
    result = prediction_error(
        predicted_gain=0.4, observed_gain=0.25, observed_source=source
    )

    assert result["prediction_error"] == NOT_AVAILABLE
    assert result["observed_gain"] == NOT_AVAILABLE
    assert result["observed_source"] == NOT_AVAILABLE
    assert result["refused_source"] == source


def test_14d_08b_a_completion_boolean_is_never_an_observed_gain() -> None:
    """Requirement 7 — ``True`` is not 1.0, and a completion flag measures nothing."""
    # A bool is refused as a figure outright, so a completion flag cannot be passed
    # through as an observed gain of one.
    with pytest.raises(CalibrationInputError):
        prediction_error(predicted_gain=0.4, observed_gain=True, observed_source=MEASURED)

    # And a boolean completion flag is not a source either.
    assert (
        prediction_error(
            predicted_gain=0.4, observed_gain=1.0, observed_source=True
        )["prediction_error"]
        == NOT_AVAILABLE
    )


def test_14d_09_a_model_internal_delta_cannot_stand_in_for_an_observed_gain() -> None:
    """Requirement 9 — feeding the model's own delta back would fake perfection."""
    internal = closure_result()["validation"]["model_internal_delta"]

    result = prediction_error(
        predicted_gain=0.4,
        observed_gain=abs(internal),
        observed_source="model_internal_delta",
    )

    assert result["prediction_error"] == NOT_AVAILABLE
    assert result["refused_source"] == "model_internal_delta"


def test_14d_09b_the_model_internal_delta_is_never_renamed_to_actual_gain() -> None:
    """Requirement 9 — the honest name is the only name, anywhere in a result."""
    batch = calibrate_gap_closures(signals(), signals("Python SQL"))

    forbidden = ("actual_gain", "actual_learner_gain", "observed_learner_gain")
    for name in forbidden:
        assert name not in batch["validation"]
        for row in batch["skills"]:
            assert name not in row
            assert name not in row["validation"]

    assert batch["skills"][0]["validation"]["model_internal_delta"] == -0.4


# ------------------------------------------- 14D.3 unavailable, not zeroed


def test_14d_10_forbidden_fields_stay_absent_when_no_observed_source_exists() -> None:
    """Requirement 10 — refused figures have no field to hold a value."""
    single = closure_result()
    batch = calibrate_gap_closures(signals(), signals("Python SQL"))

    for result in [single, batch, *batch["skills"]]:
        # No top-level key collides with a figure this module refuses to report.
        assert set(result).isdisjoint(CALIBRATION_NOT_AVAILABLE)

    for row in [single, *batch["skills"]]:
        for name in ("actual_gain", "prediction_accuracy", "mae", "rmse"):
            assert name not in row
            assert name not in row["validation"]
        # What is present under those names holds the sentinel, never a number.
        for name in ("observed_gain", "prediction_error"):
            assert isinstance(row["validation"][name], str)
            assert row["validation"][name] == NOT_AVAILABLE


def test_14d_11_no_fake_zero_is_ever_reported_for_an_unavailable_learner_outcome() -> None:
    """Requirement 11 — zero is a measurement, and none was made."""
    single = closure_result()
    batch = calibrate_gap_closures(signals(), signals("Python SQL"))

    for result in [single, batch]:
        for name in ("observed_gain", "prediction_error"):
            assert result["validation"][name] == NOT_AVAILABLE
            assert result["validation"][name] != 0
            assert result["validation"][name] != 0.0
            assert result["validation"][name] is not None

    for row in [single, *batch["skills"]]:
        for name in ("observed_gain", "prediction_error"):
            assert row["validation"][name] == NOT_AVAILABLE
            assert not isinstance(row["validation"][name], (int, float))

    # A genuine closure's zero consistency error is arithmetic, not a stand-in for a
    # learner figure, so the two zeros must not be confusable.
    assert single["validation"]["model_internal_consistency_error"] == 0.0
    assert single["validation"]["observed_gain"] != 0.0


def test_14d_11b_the_batch_does_not_average_an_inconsistency_away() -> None:
    """One disagreeing skill must not vanish into a mean of zero."""
    before = [
        {"skill": "sql", "gap": True, "signal_score": 0.9},
        {"skill": "python", "gap": True, "signal_score": 0.9},
    ]
    after = [
        {"skill": "sql", "gap": False, "signal_score": 0.3},  # moved 0.6, not the weight
        {"skill": "python", "gap": False, "signal_score": 0.5},  # exactly the weight
    ]

    batch = calibrate_gap_closures(before, after)

    assert batch["validation"]["all_results_consistent"] is False
    assert batch["validation"]["inconsistent_skills"] == ["sql"]
    # 0.6 measured against 0.4 expected, so 0.2 — and it is summed, not averaged, so
    # the agreeing row cannot cancel it out.
    assert batch["validation"]["model_internal_consistency_error"] == 0.2


# ------------------------------------------------------------ 14D.4 provenance


def test_14d_12_the_provenance_names_the_missing_observation_in_words() -> None:
    """The reason travels with the figure, because a consumer sees no docstring."""
    result = closure_result()

    assert (
        result["validation"]["observed_not_available_note"]
        == OBSERVED_NOT_AVAILABLE_NOTE
    )
    assert result["provenance"]["observed_not_available_note"] == OBSERVED_NOT_AVAILABLE_NOTE
    assert "Observed learner improvement is not available" in (
        OBSERVED_NOT_AVAILABLE_NOTE
    )
    assert "not independently verified" in OBSERVED_NOT_AVAILABLE_NOTE


def test_the_consistency_check_is_not_presented_as_prediction_accuracy() -> None:
    """A model compared against itself cannot be called accurate."""
    result = model_internal_consistency_error(expected_gain=0.4, measured_magnitude=0.4)

    assert result["measure"] == "model_internal_consistency_check"
    assert "not prediction accuracy" in result["provenance"]["is_not"]
    for name in ("prediction_error", "prediction_accuracy", "mae", "rmse", "observed_gain"):
        assert name not in result
    # The figures a consistency check has no input for are named as such. Note that
    # `prediction_error` is not among them: this module can compute it in principle,
    # which is exactly why it must not be claimed by a result that cannot.
    for name in ("prediction_accuracy", "mae", "rmse", "observed_gain"):
        assert name in result["provenance"]["not_a_measure_of"]


def test_the_refusal_message_names_the_values_that_must_not_be_passed() -> None:
    """A caller who tried the wrong thing is told which things were wrong."""
    result = prediction_error(
        predicted_gain=0.4, observed_gain=0.25, observed_source="learner_asserted"
    )

    assert "learner_asserted" in result["reason"]
    assert "learner assertions" in result["reason"]
    assert "model-internal delta" in result["reason"]


def test_a_malformed_supplied_figure_is_an_error_not_a_not_available() -> None:
    """Absent input is expected state; a mistyped one is a mistake worth raising."""
    for bad in ("0.4", True, float("nan"), float("inf")):
        with pytest.raises(CalibrationInputError):
            prediction_error(predicted_gain=bad, observed_source=MEASURED)

    with pytest.raises(CalibrationInputError):
        prediction_error(predicted_gain=0.4, observed_gain="0.25", observed_source=MEASURED)

    with pytest.raises(CalibrationInputError):
        model_internal_consistency_error(expected_gain=None, measured_magnitude=0.4)


# ------------------------------------------------------- 14D.5 inputs untouched


def test_14d_12b_the_validation_functions_do_not_mutate_their_inputs() -> None:
    """Requirement 12 — nothing this stage adds writes to a caller's figure."""
    supplied = {"observed_gain": 0.25, "observed_source": MEASURED, "note": "keep me"}
    snapshot = deepcopy(supplied)

    result = prediction_error(
        predicted_gain=supplied["observed_gain"],
        observed_gain=supplied["observed_gain"],
        observed_source=supplied["observed_source"],
    )
    result["observed_gain"] = 99.0

    assert supplied == snapshot


def test_14d_12b2_the_measured_inputs_are_still_not_mutated() -> None:
    """Requirement 12 — the model-internal half takes numbers, not structures."""
    expected, measured = 0.4, 0.4

    result = model_internal_consistency_error(
        expected_gain=expected, measured_magnitude=measured
    )
    result["model_internal_consistency_error"] = 99.0

    assert (expected, measured) == (0.4, 0.4)
    assert measurement_again() == 0.0


def measurement_again() -> float:
    """A second call, to prove the first did not leave state behind."""
    return model_internal_consistency_error(
        expected_gain=0.4, measured_magnitude=0.4
    )["model_internal_consistency_error"]


def test_the_module_produces_no_observed_figure_from_a_calibration_row() -> None:
    """The end-to-end guarantee: measuring a closure never yields an observation."""
    result = closure_result()

    assert result["validation"]["prediction_error"] == NOT_AVAILABLE
    assert result["validation"]["observed_gain"] == NOT_AVAILABLE
    # And calling the real function with this row's own fields still refuses.
    assert (
        prediction_error(
            predicted_gain=result["predicted_gain"],
            observed_gain=result["validation"]["model_internal_delta"],
            observed_source=result["provenance"]["measure"],
        )["prediction_error"]
        == NOT_AVAILABLE
    )