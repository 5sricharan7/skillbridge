from fastapi import FastAPI

if __package__:
    from .engines.optimizer import optimize_roadmap
    from .engines.signal_engine import extract_signals
    from .engines.velocity_engine import get_skill_velocity
    from .schemas import RoadmapRequest, RoadmapResponse
else:
    from engines.optimizer import optimize_roadmap
    from engines.signal_engine import extract_signals
    from engines.velocity_engine import get_skill_velocity
    from schemas import RoadmapRequest, RoadmapResponse


app = FastAPI(title="SkillBridge API")


def _enrich_with_velocity(signals: list[object]) -> list[dict[str, object]]:
    enriched: list[dict[str, object]] = []
    for signal in signals:
        if not isinstance(signal, dict):
            continue
        skill = signal.get("skill")
        if not isinstance(skill, str) or not skill.strip():
            continue
        try:
            velocity = get_skill_velocity(skill)
        except (TypeError, ValueError):
            velocity = {}
        trend = (
            velocity.get("trend", "insufficient_data")
            if isinstance(velocity, dict)
            else "insufficient_data"
        )
        enriched_signal = dict(signal)
        enriched_signal["trend"] = trend
        enriched.append(enriched_signal)
    return enriched


@app.post("/roadmap", response_model=RoadmapResponse)
def create_roadmap(payload: RoadmapRequest) -> RoadmapResponse:
    signals = extract_signals(payload.resume_text, payload.jd_text)
    enriched_signals = _enrich_with_velocity(signals)
    result = optimize_roadmap(enriched_signals, payload.budget_hours)
    return RoadmapResponse(
        budget_hours=result["budget_hours"],
        roadmap=result["roadmap"],
    )


@app.get("/velocity/{skill}")
def get_velocity(skill: str) -> dict[str, object]:
    return get_skill_velocity(skill)


@app.get("/vendor-flags", response_model=list[dict[str, object]])
def get_vendor_flags() -> list[dict[str, object]]:
    return []


@app.get("/proofs", response_model=list[dict[str, object]])
def get_proofs() -> list[dict[str, object]]:
    return []
