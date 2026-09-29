import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

if __package__:
    from .data.adapters import (
        UnplannableTargetRoleError,
        UnknownTargetRoleError,
        adapt_signals_for_role,
        validate_target_role,
    )
    from .data.curriculum_intelligence import build_role_curriculum_intelligence
    from .data.proofs import normalize_proofs
    from .engines.optimizer import optimize_roadmap
    from .engines.signal_engine import extract_signals
    from .engines.velocity_engine import get_skill_velocity
    from .schemas import RoadmapRequest, RoadmapResponse
else:
    from data.adapters import (
        UnplannableTargetRoleError,
        UnknownTargetRoleError,
        adapt_signals_for_role,
        validate_target_role,
    )
    from data.curriculum_intelligence import build_role_curriculum_intelligence
    from data.proofs import normalize_proofs
    from engines.optimizer import optimize_roadmap
    from engines.signal_engine import extract_signals
    from engines.velocity_engine import get_skill_velocity
    from schemas import RoadmapRequest, RoadmapResponse


def _configured_cors_origins() -> list[str]:
    configured = os.environ.get("SKILLBRIDGE_CORS_ORIGINS")
    if configured is None:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


app = FastAPI(title="SkillBridge API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "ok"}


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
    target_role = None
    if payload.target_role is not None:
        try:
            target_role = validate_target_role(payload.target_role)
        except UnknownTargetRoleError as error:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": str(error),
                    "valid_roles": list(error.valid_roles),
                },
            ) from error
        except UnplannableTargetRoleError as error:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": str(error),
                    "plannable_roles": list(error.plannable_roles),
                },
            ) from error

    signals = extract_signals(payload.resume_text, payload.jd_text)
    enriched_signals = _enrich_with_velocity(signals)
    if target_role is not None:
        enriched_signals = adapt_signals_for_role(
            enriched_signals, target_role
        ).signals
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
    return normalize_proofs()


@app.get("/curriculum-intelligence/{role}")
def get_curriculum_intelligence(role: str) -> dict[str, object]:
    """Serve one role's recorded skills, velocity slices, hours, and DAG.

    A role the artifacts do not know is a 422 listing the roles they do, the
    same shape ``POST /roadmap`` already returns. A known role without learning
    data is answered with ``plannable: false`` rather than an error.
    """
    try:
        return build_role_curriculum_intelligence(role)
    except UnknownTargetRoleError as error:
        raise HTTPException(
            status_code=422,
            detail={
                "message": str(error),
                "valid_roles": list(error.valid_roles),
            },
        ) from error
