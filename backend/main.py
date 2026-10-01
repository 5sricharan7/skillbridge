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
    from .data.curriculum_gaps import build_role_curriculum_gaps
    from .data.curriculum_intelligence import build_role_curriculum_intelligence
    from .data.curriculum_record import (
        CurriculumRecordError,
        build_curriculum_coverage,
        load_curriculum_record,
    )
    from .data.curriculum_recommendations import (
        build_role_curriculum_recommendations,
    )
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
    from data.curriculum_gaps import build_role_curriculum_gaps
    from data.curriculum_intelligence import build_role_curriculum_intelligence
    from data.curriculum_record import (
        CurriculumRecordError,
        build_curriculum_coverage,
        load_curriculum_record,
    )
    from data.curriculum_recommendations import (
        build_role_curriculum_recommendations,
    )
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


@app.get("/curriculum-record")
def get_curriculum_record() -> dict[str, object]:
    """Serve the curriculum record, and only what it actually records.

    The served record is the Stage 8A curriculum contract: programme, curriculum
    version, academic year, semester, course, and the skills each course
    explicitly records. An unreached field is ``null`` and is named in
    ``not_recorded``; nothing is scored, ranked, or inferred. The only record this
    repository holds is the demonstration one, so it arrives labelled as such.

    Incomplete data is reported under ``validation`` rather than hidden or
    repaired. That includes prerequisite cycles, which are listed as cycle paths
    and left in place.
    """
    try:
        return load_curriculum_record()
    except CurriculumRecordError as error:
        raise HTTPException(
            status_code=500,
            detail={"message": str(error)},
        ) from error


@app.get("/curriculum-coverage/{role}")
def get_curriculum_coverage(role: str) -> dict[str, object]:
    """Join the curriculum record to one role's Stage 7 intelligence.

    A course skill is matched to an industry skill only on an exact normalized
    name. Skills the artifacts do not record for that role are reported separately
    rather than counted as coverage, and an unknown role is a 422 listing the roles
    the artifacts do know, the same shape the other role routes return.
    """
    try:
        return build_curriculum_coverage(role)
    except UnknownTargetRoleError as error:
        raise HTTPException(
            status_code=422,
            detail={
                "message": str(error),
                "valid_roles": list(error.valid_roles),
            },
        ) from error
    except CurriculumRecordError as error:
        raise HTTPException(
            status_code=500,
            detail={"message": str(error)},
        ) from error


@app.get("/curriculum-gaps/{role}")
def get_curriculum_gaps(role: str) -> dict[str, object]:
    """Compare the curriculum record to one role's Stage 7 intelligence.

    Every skill the industry records is reported with the evidence behind it, the
    courses that already cover it, and what that evidence does not say. A skill is
    covered only when at least one course records the same normalized skill name. A
    curriculum skill the industry never recorded is reported separately and is
    neither a gap nor coverage.

    Nothing is scored, ranked, weighted, or turned into a percentage, and no
    semester placement is proposed here. A null measurement stays null and is named
    in the record's ``evidence_limitations``.

    An unknown role is a 422 listing the roles the artifacts do know, the same shape
    the other role routes return.
    """
    try:
        return build_role_curriculum_gaps(role)
    except UnknownTargetRoleError as error:
        raise HTTPException(
            status_code=422,
            detail={
                "message": str(error),
                "valid_roles": list(error.valid_roles),
            },
        ) from error
    except CurriculumRecordError as error:
        raise HTTPException(
            status_code=500,
            detail={"message": str(error)},
        ) from error


@app.get("/curriculum-recommendations/{role}")
def get_curriculum_recommendations(role: str) -> dict[str, object]:
    """Place one role's curriculum gaps inside the recorded semester structure.

    Every gap Stage 8C recorded becomes one recommendation that either names an
    existing semester and course, or says that no placement can be justified and
    which recorded fact is missing. Placement uses recorded prerequisites only, and
    an unplaceable gap is still reported rather than dropped.

    Nothing is scored, ranked, prioritised, or turned into a percentage; no
    curriculum revision, new course, or new semester is proposed; and recorded
    hours, credits, and nulls are copied rather than estimated.

    An unknown role is a 422 listing the roles the artifacts do know, the same shape
    the other role routes return.
    """
    try:
        return build_role_curriculum_recommendations(role)
    except UnknownTargetRoleError as error:
        raise HTTPException(
            status_code=422,
            detail={
                "message": str(error),
                "valid_roles": list(error.valid_roles),
            },
        ) from error
    except CurriculumRecordError as error:
        raise HTTPException(
            status_code=500,
            detail={"message": str(error)},
        ) from error
