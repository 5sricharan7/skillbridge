"""Stage 14C — one learner-asserted skill completion, measured against itself.

A learner marks a recommended skill complete. Nothing here checks whether they
did: the assertion is the learner's own statement, it is recorded as such, and
every result says so. ``COMPLETION_SOURCE`` is ``learner_asserted`` and
``VERIFICATION_STATUS`` is ``not_verified`` because no stage, artifact or
endpoint in this repository can verify a completion.

What the function does with that assertion is narrow and mechanical:

1. Plan the route from the learner's own submitted text (BEFORE).
2. Append the asserted skill to that text and plan again (AFTER), through the
   same pipeline in :mod:`backend.data.roadmap_pipeline`, so the two plans are
   comparable by construction.
3. Hand both plans' signals to the Stage 14A engine,
   :func:`backend.data.calibration.calibrate_gap_closure`, which measures the
   gap-closure delta between them.

The figure that comes back is a *model-internal* delta: it says the signal
engine's own requirement score for one skill fell by one term because the text
it was given now names a skill it previously did not. That is all it says. It is
not a learner's improvement, not mastery, not employability, not a placement or
hiring outcome, and not a prediction that any of those will follow.
``COMPLETION_NOT_A_MEASURE_OF`` names those figures instead of approximating
them, and ``is_synthetic`` is ``false`` throughout: an assertion the learner
just made is a real event, even though the number beside it is only arithmetic.

Composition of the AFTER text happens here rather than in the caller, so the
caller cannot send a resume and an asserted-skill list that disagree about what
was appended. Callers keep sending the learner's original extracted text plus
the skills asserted so far; this module owns the join.

Nothing is persisted. The learner's original text and the list of asserted
skills are request inputs, the comparison is the response, and no part of it is
retained after the call returns.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any, Optional

if __package__ and "." in __package__:
    from .adapters import normalize_skill
    from .calibration import (
        CALIBRATION_NOT_AVAILABLE,
        OBSERVED_NOT_AVAILABLE_NOTE,
        CalibrationInputError,
        calibrate_gap_closure,
    )
    from .roadmap_pipeline import plan_roadmap
else:
    from adapters import normalize_skill
    from calibration import (
        CALIBRATION_NOT_AVAILABLE,
        OBSERVED_NOT_AVAILABLE_NOTE,
        CalibrationInputError,
        calibrate_gap_closure,
    )
    from roadmap_pipeline import plan_roadmap


__all__ = [
    "COMPLETION_BOUNDARY",
    "COMPLETION_NOTE",
    "COMPLETION_NOT_A_MEASURE_OF",
    "COMPLETION_SOURCE",
    "VERIFICATION_STATUS",
    "CompletionInputError",
    "asserted_skill_names",
    "build_skill_completion_comparison",
    "resume_text_with_assertions",
]

#: Where the completion came from. A learner statement, never an assessment.
COMPLETION_SOURCE = "learner_asserted"

#: What has been done to check that statement. Nothing.
VERIFICATION_STATUS = "not_verified"

#: The figures this stage cannot support, named rather than approximated. The
#: first nine are Stage 14A's, because the delta below is Stage 14A's; the rest
#: are what "a learner completed a skill" could be misread as on its own.
COMPLETION_NOT_A_MEASURE_OF: tuple[str, ...] = CALIBRATION_NOT_AVAILABLE + (
    "actual_gain",
    "employability_score",
    "learner_improvement",
    "skill_mastery",
)

COMPLETION_BOUNDARY = (
    "Model-internal gap-closure delta after a learner-asserted completion. "
    "Asserted by learner — not independently verified."
)

COMPLETION_NOTE = (
    "Model-internal gap-closure delta. Completion was asserted by the learner."
)

GAP_STATUS_CLOSED = "closed"
GAP_STATUS_ALREADY_PRESENT = "already_present"
GAP_STATUS_NOT_CLOSED = "not_closed"

_GAP_STATUS_COPY = {
    GAP_STATUS_ALREADY_PRESENT: (
        "The engine already recorded this skill as present in the learner's text "
        "before the assertion, so there was no recorded gap to close and the "
        "score did not move."
    ),
    GAP_STATUS_NOT_CLOSED: (
        "The engine did not record this skill as a gap that closed between the "
        "two plans, so there is no closure to report."
    ),
}


class CompletionInputError(ValueError):
    """Raised when a completion request cannot be read as one assertion.

    Carries the reason in words rather than dropping the request silently, so a
    caller can tell an empty skill name and an already-asserted skill apart.
    """


def asserted_skill_names(skills: Optional[Iterable[object]]) -> tuple[str, ...]:
    """Normalize and de-duplicate learner-asserted skills, order preserved.

    Normalization is :func:`adapters.normalize_skill`, the same casefold-and-
    whitespace key the artifacts, the optimizer and Stage 14A match on, so
    ``"Machine Learning"`` and ``"machine learning"`` are one skill rather than
    two. A repeated name is dropped instead of appended twice, because the same
    assertion counted twice would read as two completions.
    """
    names: list[str] = []
    seen: set[str] = set()
    for raw in skills or ():
        if not isinstance(raw, str):
            continue
        name = normalize_skill(raw)
        if not name or name in seen:
            continue
        seen.add(name)
        names.append(name)
    return tuple(names)


def resume_text_with_assertions(
    resume_text: object, names: Iterable[str]
) -> str:
    """Join the learner's submitted text with the skills they assert complete.

    The appended names are joined the way a resume lists skills, on their own
    lines after the learner's own text. No other change is made to the text: the
    engine is given the learner's words plus the assertion, nothing invented in
    place of either.
    """
    parts: list[str] = []
    if isinstance(resume_text, str) and resume_text.strip():
        parts.append(resume_text.strip())
    parts.extend(name for name in names if name)
    return "\n".join(parts)


def _gap_status(row: Mapping[str, Any]) -> str:
    if row["gap_closed"]:
        return GAP_STATUS_CLOSED
    if not row["before_gap"]:
        return GAP_STATUS_ALREADY_PRESENT
    return GAP_STATUS_NOT_CLOSED


def build_skill_completion_comparison(
    *,
    resume_text: str,
    jd_text: str,
    budget_hours: int,
    skill: str,
    completed_skills: Optional[Iterable[object]] = None,
    target_role: Optional[str] = None,
) -> dict[str, Any]:
    """Plan before and after one asserted completion and measure the difference.

    ``resume_text`` is the learner's own submitted text and ``completed_skills``
    are the skills they asserted earlier in the session; both plans are built
    from those inputs, so each completion is measured against the context that
    came before it rather than against the original text every time. ``skill`` is
    the skill asserted by this call.

    The response keeps both plans — ``before_roadmap`` and ``after_roadmap`` —
    so the comparison can be read against the two routes themselves, and both are
    the optimizer's own output through
    :func:`backend.data.roadmap_pipeline.plan_roadmap`. The figures for the
    asserted skill come from the Stage 14A engine reading those two plans'
    signals, so they cannot disagree with the plans beside them.

    An unknown or unplannable ``target_role`` raises the adapters' own errors, so
    this call fails for the same reasons ``POST /roadmap`` does.
    """
    name = normalize_skill(skill) if isinstance(skill, str) else ""
    if not name:
        raise CompletionInputError(
            "skill is required and cannot be blank, so there is no completion to compare."
        )

    prior = asserted_skill_names(completed_skills)
    if name in prior:
        raise CompletionInputError(
            f"{name!r} is already one of this learner's asserted completions, so "
            "there is no new completion to compare."
        )

    before = plan_roadmap(
        resume_text=resume_text,
        jd_text=jd_text,
        budget_hours=budget_hours,
        target_role=target_role,
    )
    after_resume_text = resume_text_with_assertions(resume_text, (*prior, name))
    after = plan_roadmap(
        resume_text=after_resume_text,
        jd_text=jd_text,
        budget_hours=budget_hours,
        target_role=target_role,
    )

    try:
        row = calibrate_gap_closure(before["signals"], after["signals"], name)
    except CalibrationInputError as error:
        # The job description names no signal for this skill, so there is no
        # second score to subtract. Refused, not estimated.
        raise CompletionInputError(str(error)) from error

    gap_status = _gap_status(row)
    asserted = [*prior, name]

    return {
        "skill": name,
        "completion_source": COMPLETION_SOURCE,
        "verification_status": VERIFICATION_STATUS,
        "before_score": row["before_score"],
        "after_score": row["after_score"],
        "delta": row["delta"],
        "predicted_gain": row["predicted_gain"],
        "gap_closed": row["gap_closed"],
        "gap_status": gap_status,
        "gap_status_note": _GAP_STATUS_COPY.get(gap_status, ""),
        "matches_predicted_gain": row["matches_predicted_gain"],
        # Stage 14D. The magnitude behind the boolean above, from the same
        # calibration row, so the completion flow surfaces the model-internal
        # consistency check rather than leaving it computed and unread.
        "model_internal_consistency_error": row["model_internal_consistency_error"],
        "gap_weight": row["provenance"]["gap_weight"],
        "before_roadmap": before["roadmap"],
        "after_roadmap": after["roadmap"],
        "before_budget_hours": before["budget_hours"],
        "after_budget_hours": after["budget_hours"],
        "target_role": before["target_role"],
        "asserted_skills": asserted,
        "assertion_count": len(asserted),
        "provenance": {
            "measure": row["provenance"]["measure"],
            "engine": row["provenance"]["engine"],
            "gap_weight": row["provenance"]["gap_weight"],
            "score_precision": row["provenance"]["score_precision"],
            "boundary": COMPLETION_BOUNDARY,
            "note": COMPLETION_NOTE,
            "basis": (
                "before and after are two plans of the same texts, differing only "
                "by the learner's own assertion that this skill is now complete. "
                "The delta is measured from the signal scores those two plans used."
            ),
            "completion_source": COMPLETION_SOURCE,
            "verification_status": VERIFICATION_STATUS,
            # Spelled out on the endpoint rather than left to the `not_a_measure_of`
            # list alone, because the consistency error is a real figure and a reader
            # could take its presence as licence to read a learner figure beside it.
            "observed_not_available_note": OBSERVED_NOT_AVAILABLE_NOTE,
            "model_internal_consistency_note": (
                "model_internal_consistency_error compares the gap-closure "
                "magnitude the model expected against the magnitude its own two "
                "plans produced. Both sides are the same engine's arithmetic, so "
                "it is a consistency check and not prediction accuracy, and it "
                "involves no measured learner."
            ),
            "not_a_measure_of": list(COMPLETION_NOT_A_MEASURE_OF),
        },
        "not_a_measure_of": list(COMPLETION_NOT_A_MEASURE_OF),
        "is_synthetic": False,
    }
