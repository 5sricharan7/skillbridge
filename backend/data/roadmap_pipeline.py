"""The one roadmap pipeline ``POST /roadmap`` and Stage 14C both plan through.

``POST /roadmap`` already had this sequence inline: extract the signals, attach
each skill's recorded velocity trend, adapt them to the caller's target role,
and optimize within the budget. Stage 14C has to plan the same route twice for
one request — once from the learner's text, once from that text plus an asserted
skill — and the two plans are only a comparison if both went through identical
inputs. Re-implementing the sequence would let the BEFORE plan and the plan the
learner actually saw drift apart, so it lives here once and both callers use it.

Moving the sequence here does not change what ``POST /roadmap`` returns. The
response shape is still ``{budget_hours, roadmap}`` produced by the same
optimizer over the same enriched, role-adapted signals; only the ``signals`` the
optimizer saw and the normalized ``target_role`` are additionally returned, for
callers that need to measure a delta between two plans.

Nothing here stores anything. A plan exists for the length of one call and is
not retained, and no route in this module reads or writes a learner record.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Optional

if __package__ and "." in __package__:
    from ..engines.optimizer import optimize_roadmap
    from ..engines.signal_engine import extract_signals
    from ..engines.velocity_engine import get_skill_velocity
    from .adapters import adapt_signals_for_role, validate_target_role
else:
    from engines.optimizer import optimize_roadmap
    from engines.signal_engine import extract_signals
    from engines.velocity_engine import get_skill_velocity
    from adapters import adapt_signals_for_role, validate_target_role


__all__ = ["enrich_signals_with_velocity", "plan_roadmap"]

#: Trend values the optimizer reads. Anything else is recorded as unavailable
#: rather than passed through, because the reason text quotes the trend name.
_UNAVAILABLE_TREND = "insufficient_data"


def enrich_signals_with_velocity(signals: Sequence[object]) -> list[dict[str, object]]:
    """Attach each skill's recorded velocity trend to its signal.

    A skill with no recorded series is kept with ``insufficient_data`` rather
    than dropped, and a velocity lookup that raises contributes the same
    unavailable trend. Rows without a usable skill name are dropped here: the
    optimizer could not plan them, and keeping one would make the returned
    ``signals`` disagree with the returned ``roadmap``.
    """
    enriched: list[dict[str, object]] = []
    for signal in signals:
        if not isinstance(signal, Mapping):
            continue
        skill = signal.get("skill")
        if not isinstance(skill, str) or not skill.strip():
            continue
        try:
            velocity = get_skill_velocity(skill)
        except (TypeError, ValueError):
            velocity = {}
        trend = (
            velocity.get("trend", _UNAVAILABLE_TREND)
            if isinstance(velocity, Mapping)
            else _UNAVAILABLE_TREND
        )
        enriched_signal = dict(signal)
        enriched_signal["trend"] = trend
        enriched.append(enriched_signal)
    return enriched


def plan_roadmap(
    *,
    resume_text: str,
    jd_text: str,
    budget_hours: int,
    target_role: Optional[str] = None,
) -> dict[str, Any]:
    """Plan one route from two texts, through the pipeline ``POST /roadmap`` uses.

    Returns ``budget_hours`` and ``roadmap`` exactly as the optimizer produced
    them, plus the ``signals`` the optimizer was given and the normalized
    ``target_role`` (``None`` when no role was requested). The signals are the
    plan's own inputs, so a caller comparing two plans measures between two
    results the optimizer really used rather than between two sets of scores it
    computed separately.

    ``target_role`` is validated before planning, so an unknown or unplannable
    role raises ``UnknownTargetRoleError`` / ``UnplannableTargetRoleError``
    rather than being silently dropped from the plan.
    """
    role = validate_target_role(target_role) if target_role is not None else None

    signals: list[dict[str, object]] = enrich_signals_with_velocity(
        extract_signals(resume_text, jd_text)
    )
    if role is not None:
        signals = list(adapt_signals_for_role(signals, role).signals)

    result = optimize_roadmap(signals, budget_hours)
    return {
        "budget_hours": result["budget_hours"],
        "roadmap": result["roadmap"],
        "signals": signals,
        "target_role": role,
    }
