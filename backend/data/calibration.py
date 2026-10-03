"""Stage 14A — the model-internal gap-closure delta between two results.
Stage 14D — validation arithmetic that refuses to invent the missing half.

This module measures one thing: how the signal engine's own ``signal_score`` for a
single skill changes between a BEFORE result and an AFTER result when the AFTER
result stops recording that requested skill as missing.

Both sides are results that already exist. The BEFORE and AFTER inputs are the
signal lists the engine produced — the same ones ``POST /roadmap`` builds through
:func:`engines.signal_engine.extract_signals` — and nothing here recomputes them,
plans a roadmap, or changes a request or response shape. :func:`calibrate_gap_closure`
is pure arithmetic over two supplied results.

Stage 14D adds the arithmetic that a validation study would need, in the two states
it can honestly be in today:

**Model consistency check** — :func:`model_internal_consistency_error` compares the
gap-closure magnitude the model expects against the magnitude its own two results
actually produced. Both sides are the same engine's arithmetic, so a genuine closure
gives an error of exactly ``0``. This is a consistency check and nothing else: it
cannot detect a wrong model, because there is no second opinion in the comparison.

**Prediction error** — :func:`prediction_error` is the one function here that would
report a real prediction error, and it can only do so when a caller supplies an
observed gain *and* declares which instrument measured it. No such source exists in
this repository, so every current result reports ``observed_gain`` and
``prediction_error`` as :data:`NOT_AVAILABLE` rather than as ``0.0``.

Design constraints, all deliberate:

* **One formula, already in the engine.** The weight is read from
  ``signal_engine._GAP_WEIGHT`` rather than restated here, so the figure cannot
  drift when the engine changes. The engine scores a requested skill as
  ``0.6 * min(jd_frequency / 5, 1)`` plus that gap weight when the resume does not
  name the skill, and the frequency term alone when it does. Naming a previously
  missing skill therefore removes exactly one term, and the measured change for a
  single genuine closure is ``-0.4``.
* **The delta is measured, not assumed.** ``delta`` is ``after_score -
  before_score`` computed from the two supplied scores. The direction is never
  inferred from the gap flag: a pair whose ``jd_frequency`` also changed reports
  that different number, and ``matches_predicted_gain`` is then ``false``. A gap
  that opens rather than closes reports a positive delta with
  ``gap_closed: false``.
* **A closure is a flag flip, and the flags must agree.** The engine sets ``gap``
  to the absence of the skill from the resume, so a record claiming ``gap: true``
  alongside ``in_resume: true`` is refused rather than read as a closure.
* **Scores are copied, never restated.** ``before_score`` and ``after_score`` are
  the supplied values unchanged, and no input mapping is mutated.
* **This is a model-internal arithmetic delta, not an outcome.** It says the
  engine's requirement signal for one skill moved by a fixed term because a resume
  text now names a skill it previously did not. It is not a measure of a real
  person, a real course, a real hire, or a real placement, and this repository
  holds no learner record from which one could be measured.
  ``CALIBRATION_NOT_AVAILABLE`` names those figures as unavailable rather than
  approximating them; observed gain, prediction accuracy, MAE/RMSE, calibration
  statistics, and verified completion are later substages, and no result here
  contains any of them.
* **Deterministic and stateless.** The same pair always produces the same rows in
  the same order. Nothing is sampled, generated, or stored, which is why every
  result reports ``is_synthetic: false``: the figure is arithmetic on results the
  engine already produced, not simulated data.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

from .adapters import normalize_skill

if __package__ and "." in __package__:
    from ..engines import signal_engine
else:
    from engines import signal_engine

__all__ = [
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
]

#: The engine's missing-skill weight, read from the engine that applies it. A
#: second literal copy of ``0.4`` here would be an independent constant that could
#: disagree with the score it is supposed to explain.
GAP_WEIGHT: float = float(signal_engine._GAP_WEIGHT)

#: ``signal_engine`` rounds every ``signal_score`` to two decimals, so a difference
#: between two of its scores is reported at the same precision. Without this,
#: ``0.24 - 0.64`` returns ``-0.40000000000000002`` instead of ``-0.4``.
SCORE_PRECISION = 2

#: Figures this stage cannot support, named rather than approximated. There is no
#: learner record in this repository, so none of them has an input to be computed
#: from; they belong to later substages and are absent from every result here.
CALIBRATION_NOT_AVAILABLE: tuple[str, ...] = (
    "actual_learner_gain",
    "calibration_statistics",
    "hiring_probability",
    "mae",
    "observed_gain",
    "placement_probability",
    "prediction_accuracy",
    "rmse",
    "verified_completion",
)

#: The project's sentinel for a figure that has no input to be computed from.
#:
#: It is a string rather than ``None`` or ``0.0`` on purpose. ``None`` reads as an
#: absent field to a consumer that then treats the absence as zero, and ``0.0`` is a
#: real measurement that this repository has never made: reporting zero learner
#: improvement would claim the learner did not improve, which is as unsupported as
#: claiming they improved. ``"not_available"`` can only be read as itself.
NOT_AVAILABLE: str = "not_available"

#: Why the observed figures are unavailable, in the words a result carries.
#:
#: This travels inside every result rather than living in this docstring, because a
#: consumer reading a JSON payload never sees the docstring.
OBSERVED_NOT_AVAILABLE_NOTE = (
    "Observed learner improvement is not available. "
    "Learner completion is self-reported and not independently verified."
)

#: The only ``observed_source`` value :func:`prediction_error` will accept.
#:
#: No instrument in this repository produces an observed learner outcome, so this
#: token has no producer today. It exists so the arithmetic is exercisable and so
#: that a future integration has to state which instrument it is rather than
#: passing a bare number whose provenance nobody declared. Anything else — a
#: learner assertion, a completion flag, ``after_score``, the model's own delta —
#: is refused, because those are the values that could be mistaken for an
#: observation and are not one.
OBSERVED_SOURCE_MEASURED_OUTCOME = "measured_learner_outcome"

#: Named in the refusal message so a caller can see which of the plausible-looking
#: values was rejected and why, rather than only that something was.
_REFUSED_OBSERVED_SOURCE_EXAMPLES = (
    "learner_asserted",
    "self_reported",
    "after_score",
    "model_internal",
    "model_internal_delta",
)

METHOD_NOTE = (
    "delta is after_score minus before_score, both copied unchanged from the two "
    "supplied signal results, so the direction is measured from those scores rather "
    "than assumed from the gap flag. predicted_gain is the signal engine's own "
    "missing-skill weight, reported as a positive magnitude, and it is non-zero only "
    "when the BEFORE result recorded the skill as missing and the AFTER result "
    "records it as present. Because the engine adds the weight for a missing skill, "
    "a genuine closure moves delta by minus that weight: the requirement signal falls "
    "because there is no longer a recorded absence. This is arithmetic on the "
    "engine's own score for two texts. It is not an employability gain, a hiring or "
    "placement probability, a real-world learner improvement, or evidence that this "
    "repository predicts any of those. Nothing is estimated, sampled, or stored, and "
    "no before/after pair is retained after the call returns."
)


class CalibrationInputError(ValueError):
    """Raised when a BEFORE/AFTER result pair cannot be read as two results.

    Carries the offending position or skill name so a caller reading a signal list
    can find the row that needs fixing instead of being told the whole pair is
    unusable.
    """


# ------------------------------------------------------------------ result input


def _records(result: object, label: str) -> list[object]:
    """Read one side of the pair as a list of signal rows.

    Accepts what the engine and the adapters already produce: a signal mapping, a
    sequence of signal mappings, or a mapping wrapping one under ``signals``. A row
    that is not a mapping is refused by position rather than skipped, because a
    silently dropped row would silently drop a skill's delta with it.
    """
    if isinstance(result, Mapping):
        if "skill" in result:
            return [result]
        nested = result.get("signals")
        if isinstance(nested, Sequence) and not isinstance(nested, (str, bytes)):
            return list(nested)
        raise CalibrationInputError(
            f"{label} must be a signal mapping with a skill field, a sequence of "
            "signal mappings, or a mapping holding them under signals."
        )

    if isinstance(result, (str, bytes)) or not isinstance(result, Sequence):
        raise CalibrationInputError(
            f"{label} must be a signal result: a signal mapping or a sequence of "
            "signal mappings."
        )

    rows = list(result)
    for index, row in enumerate(rows):
        if not isinstance(row, Mapping):
            raise CalibrationInputError(f"{label}[{index}] must be a signal mapping.")
    return rows


def _skill_name(row: Mapping[str, object], label: str) -> str:
    raw = row.get("skill")
    if not isinstance(raw, str) or not raw.strip():
        raise CalibrationInputError(f"{label}.skill must be a non-blank skill name.")
    return normalize_skill(raw)


def _flag(row: Mapping[str, object], field: str, label: str) -> bool:
    value = row.get(field)
    if not isinstance(value, bool):
        raise CalibrationInputError(f"{label}.{field} must be true or false.")
    return value


def _signal_score(row: Mapping[str, object], label: str) -> float:
    value = row.get("signal_score")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise CalibrationInputError(f"{label}.signal_score must be a number.")
    if not math.isfinite(value):
        raise CalibrationInputError(f"{label}.signal_score must be a finite number.")
    return value


def _read_signal(row: Mapping[str, object], label: str) -> dict[str, object]:
    """Read one signal row into the fields a delta is measured from.

    ``gap`` and ``in_resume`` are read as booleans only, never coerced from a
    string, because this stage's whole claim is that a flag really flipped. When
    ``in_resume`` is present it must disagree with ``gap``, which is the
    relationship the engine maintains.
    """
    _skill_name(row, label)
    gap = _flag(row, "gap", label)
    if "in_resume" in row:
        in_resume = _flag(row, "in_resume", label)
        if gap is in_resume:
            raise CalibrationInputError(
                f"{label} records gap={gap} together with in_resume={in_resume}. "
                "The signal engine sets gap to the absence of the skill from the "
                "resume, so a closure cannot be read from a record whose two flags "
                "agree."
            )
    else:
        in_resume = not gap
    return {"signal_score": _signal_score(row, label), "gap": gap}


def _index_by_skill(rows: Sequence[object], label: str) -> dict[str, Mapping[str, object]]:
    """Index one side by normalized skill name.

    A skill named twice on the same side is refused instead of being collapsed onto
    one row, because two scores for one skill leave the delta ambiguous and a
    merge would silently pick one of them.
    """
    indexed: dict[str, Mapping[str, object]] = {}
    for index, row in enumerate(rows):
        skill = _skill_name(row, f"{label}[{index}]")
        if skill in indexed:
            raise CalibrationInputError(
                f"{label} names {skill!r} more than once, so its signal_score is "
                "ambiguous. One result may hold one signal per skill."
            )
        indexed[skill] = row
    return indexed


def _requested_skill(skill: object) -> str:
    if not isinstance(skill, str):
        raise CalibrationInputError("skill must be a skill name.")
    name = normalize_skill(skill)
    if not name:
        raise CalibrationInputError("skill is required and cannot be blank.")
    return name


def _number(value: object, field: str) -> float:
    """Read one finite figure.

    ``bool`` is refused before the numeric check because it is an ``int`` subclass:
    ``True`` would otherwise become ``1.0`` and read as a measured figure of one.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise CalibrationInputError(f"{field} must be a number.")
    if not math.isfinite(value):
        raise CalibrationInputError(f"{field} must be a finite number.")
    return float(value)


# ------------------------------------------------------------------ validation


def model_internal_consistency_error(*, expected_gain: object, measured_magnitude: object) -> dict[str, object]:
    """Compare the gap-closure magnitude the model expects against what it produced.

    ``predicted_gain`` is the model's expected magnitude for a genuine closure —
    the engine's gap weight — and ``actual_model_delta`` is
    ``abs(after_score - before_score)`` measured from the engine's own two results.
    The check is their absolute difference:

    ``model_internal_consistency_error = abs(predicted_gain - actual_model_delta)``

    For a genuine single closure the two are the same term, so the error is ``0.0``.

    **This is a consistency check, not an accuracy measure.** Both sides of the
    comparison come from the same engine, so it can detect that a result does not
    match the model that produced it, and nothing else. It is not prediction
    accuracy, not a real-world prediction error, and it involves no learner. Two
    different sources are required for any of those, and this repository has one.

    Reported at :data:`SCORE_PRECISION` because both inputs are differences of
    ``signal_score`` values the engine has already rounded to that precision.
    """
    expected = _number(expected_gain, "expected_gain")
    measured = _number(measured_magnitude, "measured_magnitude")

    error = round(abs(expected - measured), SCORE_PRECISION)

    return {
        "model_internal_expected_gain": round(expected, SCORE_PRECISION),
        "model_internal_measured_magnitude": round(measured, SCORE_PRECISION),
        "model_internal_consistency_error": error,
        "is_consistent": error == 0.0,
        "measure": "model_internal_consistency_check",
        "provenance": {
            "measure": "model_internal_consistency_check",
            "engine": "backend.engines.signal_engine",
            "score_precision": SCORE_PRECISION,
            "basis": (
                "model_internal_consistency_error is the absolute difference between "
                "the gap-closure magnitude the model expected and the magnitude its own "
                "two signal results produced. Both sides are the same engine's "
                "arithmetic, so a zero error means the results match the model that "
                "produced them."
            ),
            "is_not": (
                "not prediction accuracy, not a real-world prediction error, and not a "
                "learner outcome: a consistency check compares a model against itself "
                "and cannot detect a model that is wrong in the same way twice."
            ),
            "not_a_measure_of": list(CALIBRATION_NOT_AVAILABLE),
        },
        "is_synthetic": False,
    }


def _observed_unavailable(
    predicted: float, reason: str, refused_source: object = None
) -> dict[str, object]:
    """The shape every result takes when no observed source was supplied.

    ``prediction_error`` and ``observed_gain`` are the project's
    :data:`NOT_AVAILABLE` sentinel rather than ``0.0``, and ``reason`` says which of
    the possible reasons applied, so a consumer reading only the value still cannot
    mistake it for a measurement.
    """
    return {
        "predicted_gain": predicted,
        "observed_gain": NOT_AVAILABLE,
        "observed_source": NOT_AVAILABLE,
        "prediction_error": NOT_AVAILABLE,
        "status": NOT_AVAILABLE,
        "reason": reason,
        "not_available_note": OBSERVED_NOT_AVAILABLE_NOTE,
        "refused_source": refused_source,
        "is_synthetic": False,
    }


def prediction_error(
    *, predicted_gain: object, observed_gain: object = None, observed_source: object = None
) -> dict[str, object]:
    """The real prediction-error function, which today cannot return a number.

    ``prediction_error = predicted_gain - observed_gain``

    The subtraction is the whole of it. What makes this function safe to exist now
    is that it will only perform the subtraction when **both** an observed gain and
    the instrument that measured it are supplied, and the instrument must be
    :data:`OBSERVED_SOURCE_MEASURED_OUTCOME`. Every other outcome is
    :data:`NOT_AVAILABLE` with a reason attached.

    Three refusals matter, because these are the values that are one line away from
    being passed here by accident:

    * a learner-asserted completion, or its boolean, is a statement the learner
      made about themselves. Nothing measured it.
    * ``after_score`` is the engine's score for a resume text. It is not the
      learner, and it cannot observe the learner.
    * ``model_internal_delta`` is this module's own arithmetic. Using it as the
      observed side would make every prediction perfect by construction, which is
      exactly the error this function exists to prevent.

    So the observed side has to arrive from somewhere else, declared. A bare number
    with no ``observed_source`` is treated as unobserved, not as a measurement, and
    the result reports it that way.

    Raises :class:`CalibrationInputError` only when a figure is supplied and is
    malformed — ``predicted_gain`` or ``observed_gain`` that is not a finite
    number. An absent or unprovenanced observation is not an error; it is the
    expected state, and it is reported as such rather than raised or defaulted.
    """
    predicted = _number(predicted_gain, "predicted_gain")

    if observed_gain is None and observed_source is None:
        return _observed_unavailable(
            predicted,
            "no observed gain and no observed source were supplied, so there is "
            "nothing to compare the predicted gain against.",
        )

    if not isinstance(observed_source, str) or not observed_source.strip():
        return _observed_unavailable(
            predicted,
            "an observed gain was supplied without declaring which instrument "
            "measured it. An undeclared number is not treated as an observation.",
            refused_source=observed_source,
        )

    if observed_source.strip() != OBSERVED_SOURCE_MEASURED_OUTCOME:
        return _observed_unavailable(
            predicted,
            f"{observed_source!r} is not an observed learner outcome, so it cannot "
            "be the observed side of a prediction error. Refused sources include "
            "learner assertions, self-reported completions, engine scores, and this "
            "module's own model-internal delta.",
            refused_source=observed_source,
        )

    observed = _number(observed_gain, "observed_gain")
    return {
        "predicted_gain": predicted,
        "observed_gain": observed,
        "observed_source": OBSERVED_SOURCE_MEASURED_OUTCOME,
        "prediction_error": predicted - observed,
        "status": "measured",
        "reason": None,
        "not_available_note": None,
        "refused_source": None,
        "provenance": {
            "measure": "prediction_error",
            "observed_source": OBSERVED_SOURCE_MEASURED_OUTCOME,
            "basis": (
                "prediction_error is predicted_gain minus observed_gain, with the "
                "observed gain supplied by a declared instrument outside this "
                "repository. No such instrument is connected here, so this result is "
                "not reachable from any current route."
            ),
            "not_a_measure_of": list(CALIBRATION_NOT_AVAILABLE),
        },
        "is_synthetic": False,
    }


# ----------------------------------------------------------------------- results


def _validation_block(
    delta: float, magnitude: float, predicted_gain: float
) -> dict[str, object]:
    """Stage 14D's two halves, side by side and clearly labelled.

    The model-internal figures are computed here, from this module's own two
    results. The observed figures are not computed at all: nothing in this
    repository measured a learner, so they carry :data:`NOT_AVAILABLE` and the note
    saying so. They are placed in the same block precisely so the two halves cannot
    be read as the same kind of quantity.
    """
    consistency = model_internal_consistency_error(
        expected_gain=predicted_gain, measured_magnitude=magnitude
    )
    unavailable = prediction_error(predicted_gain=predicted_gain)

    return {
        # What changed in SkillBridge's own signal calculation.
        "model_internal_delta": delta,
        "model_internal_expected_gain": predicted_gain,
        "model_internal_measured_magnitude": magnitude,
        "model_internal_consistency_error": consistency["model_internal_consistency_error"],
        "is_consistent": consistency["is_consistent"],
        # What changed in the learner's actual proficiency. Nothing, as far as this
        # repository can tell — and it says so rather than reporting zero.
        "observed_gain": unavailable["observed_gain"],
        "prediction_error": unavailable["prediction_error"],
        "observed_source": unavailable["observed_source"],
        "observed_not_available_note": OBSERVED_NOT_AVAILABLE_NOTE,
    }


def _calibrate_one(
    skill: str,
    before_rows: Mapping[str, Mapping[str, object]],
    after_rows: Mapping[str, Mapping[str, object]],
) -> dict[str, object]:
    before_signal = _read_signal(before_rows[skill], f"before[{skill!r}]")
    after_signal = _read_signal(after_rows[skill], f"after[{skill!r}]")

    before_score = before_signal["signal_score"]
    after_score = after_signal["signal_score"]
    # Measured, not assumed: the sign and size come from the two supplied scores.
    delta = round(float(after_score) - float(before_score), SCORE_PRECISION)
    magnitude = round(abs(delta), SCORE_PRECISION)
    before_gap = bool(before_signal["gap"])
    after_gap = bool(after_signal["gap"])
    gap_closed = before_gap and not after_gap
    predicted_gain = GAP_WEIGHT if gap_closed else 0.0
    validation = _validation_block(delta, magnitude, predicted_gain)

    return {
        "skill": skill,
        "before_score": before_score,
        "after_score": after_score,
        "before_gap": before_gap,
        "after_gap": after_gap,
        "delta": delta,
        "abs_delta": magnitude,
        "predicted_gain": predicted_gain,
        "gap_closed": gap_closed,
        "matches_predicted_gain": gap_closed
        and magnitude == round(predicted_gain, SCORE_PRECISION),
        # Stage 14D. The model-internal consistency error is on the row itself, so a
        # caller holding one row does not have to recompute it, and the observed
        # figures travel with it as NOT_AVAILABLE rather than being absent.
        "model_internal_consistency_error": validation["model_internal_consistency_error"],
        "validation": validation,
        "provenance": {
            "measure": "model_internal_gap_closure_delta",
            "engine": "backend.engines.signal_engine",
            "gap_weight": GAP_WEIGHT,
            "score_precision": SCORE_PRECISION,
            "basis": (
                "delta is after_score minus before_score, each copied unchanged from "
                "the supplied signal results. A missing requested skill adds the "
                "engine's gap weight to the frequency term, so naming it removes that "
                "one term and nothing else."
            ),
            "direction_note": (
                "A genuine closure gives a negative delta: the requirement signal "
                "falls because the engine no longer records the skill as missing."
            ),
            "observed_not_available_note": OBSERVED_NOT_AVAILABLE_NOTE,
            "not_a_measure_of": list(CALIBRATION_NOT_AVAILABLE),
        },
        "is_synthetic": False,
    }


def calibrate_gap_closure(
    before: object, after: object, skill: str
) -> dict[str, object]:
    """Measure the gap-closure delta the engine itself produces for one skill.

    ``before`` and ``after`` are the already-produced signal results to compare —
    a signal mapping, a sequence of them, or a mapping holding them under
    ``signals``. The skill is matched with :func:`adapters.normalize_skill`, the
    same key the artifacts and the optimizer use, so casing and spacing never
    decide whether a result is found.

    The returned row reports ``before_score`` and ``after_score`` exactly as they
    were supplied, the measured signed ``delta`` and its ``abs_delta`` magnitude,
    and ``predicted_gain``: the engine's gap weight when the gap genuinely closed
    between the two results, ``0.0`` otherwise. Every row carries its own
    ``provenance`` and reports ``is_synthetic: false``.

    A skill that is absent from either side, named twice on one side, or unreadable
    is refused rather than estimated, because there is no second score to subtract.
    """
    name = _requested_skill(skill)
    before_rows = _index_by_skill(_records(before, "before"), "before")
    after_rows = _index_by_skill(_records(after, "after"), "after")

    for label, rows in (("before", before_rows), ("after", after_rows)):
        if name not in rows:
            raise CalibrationInputError(
                f"{label} has no signal for {name!r}, so there is no "
                f"{label}_score to compare. Both results must record the skill."
            )

    return _calibrate_one(name, before_rows, after_rows)


def calibrate_gap_closures(before: object, after: object) -> dict[str, object]:
    """Measure the gap-closure delta for every skill both results record.

    One row per skill, never one row per pair: a result with three closed gaps is
    three results with three separate scores, so two skills that happened to close
    at the same magnitude stay distinguishable. Ordering puts the largest
    magnitude first and breaks ties alphabetically, so the same pair always reads
    the same way.

    A skill only one side records cannot have a delta computed, so it is listed
    under ``unpaired_skills`` instead of being dropped or given a score of zero.
    """
    before_rows = _index_by_skill(_records(before, "before"), "before")
    after_rows = _index_by_skill(_records(after, "after"), "after")

    shared = sorted(set(before_rows) & set(after_rows))
    rows = [_calibrate_one(name, before_rows, after_rows) for name in shared]

    # Two stable passes: alphabetical first, then magnitude. Python's sort is
    # stable, so the alphabetical order survives as the tiebreak.
    rows.sort(key=lambda row: str(row["skill"]))
    rows.sort(key=lambda row: -float(row["abs_delta"]))

    return {
        "gap_weight": GAP_WEIGHT,
        "gap_closures": sum(1 for row in rows if row["gap_closed"]),
        "skills": rows,
        "unpaired_skills": {
            "missing_from_after": sorted(set(before_rows) - set(after_rows)),
            "missing_from_before": sorted(set(after_rows) - set(before_rows)),
        },
        # Stage 14D, at the batch level. The consistency error is reported as a sum
        # of the per-skill magnitudes rather than an average, because a batch where
        # one skill disagrees and the rest agree must not average out to zero. The
        # observed half is the same NOT_AVAILABLE the rows carry.
        "validation": {
            "model_internal_consistency_error": round(
                sum(float(row["model_internal_consistency_error"]) for row in rows),
                SCORE_PRECISION,
            ),
            "inconsistent_skills": [
                row["skill"]
                for row in rows
                if row["model_internal_consistency_error"] != 0.0
            ],
            "all_results_consistent": all(
                row["model_internal_consistency_error"] == 0.0 for row in rows
            ),
            "observed_gain": NOT_AVAILABLE,
            "prediction_error": NOT_AVAILABLE,
            "observed_source": NOT_AVAILABLE,
            "observed_not_available_note": OBSERVED_NOT_AVAILABLE_NOTE,
        },
        "not_available": list(CALIBRATION_NOT_AVAILABLE),
        "is_synthetic": False,
        "method_note": METHOD_NOTE,
    }