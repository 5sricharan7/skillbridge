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
    from .data.calibration import CALIBRATION_NOT_AVAILABLE
    from .data.cohort_analysis import CohortInputError, build_cohort_analysis
    from .data.completion import (
        CompletionInputError,
        build_skill_completion_comparison,
        resume_text_with_assertions,
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
    from .data.market_demand import LivePostingsError, build_market_demand
    from .data.proofs import normalize_proofs
    from .data.roadmap_pipeline import plan_roadmap
    from .engines.optimizer import optimize_roadmap
    from .engines.signal_engine import compute_skill_signals, extract_signals
    from .engines.velocity_engine import get_skill_velocity
    from .schemas import (
        CalibrationRecord,
        CalibrationResponse,
        CohortAnalysisRequest,
        RoadmapRequest,
        RoadmapResponse,
        SkillCompletionRequest,
        SkillCompletionResponse,
    )
else:
    from data.adapters import (
        UnplannableTargetRoleError,
        UnknownTargetRoleError,
        adapt_signals_for_role,
        validate_target_role,
    )
    from data.calibration import CALIBRATION_NOT_AVAILABLE
    from data.cohort_analysis import CohortInputError, build_cohort_analysis
    from data.completion import (
        CompletionInputError,
        build_skill_completion_comparison,
        resume_text_with_assertions,
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
    from data.market_demand import LivePostingsError, build_market_demand
    from data.proofs import normalize_proofs
    from data.roadmap_pipeline import plan_roadmap
    from engines.optimizer import optimize_roadmap
    from engines.signal_engine import compute_skill_signals, extract_signals
    from engines.velocity_engine import get_skill_velocity
    from schemas import (
        CalibrationRecord,
        CalibrationResponse,
        CohortAnalysisRequest,
        RoadmapRequest,
        RoadmapResponse,
        SkillCompletionRequest,
        SkillCompletionResponse,
    )


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


@app.post("/roadmap", response_model=RoadmapResponse)
def create_roadmap(payload: RoadmapRequest) -> RoadmapResponse:
    """Plan one route from the submitted resume text and job description.

    The pipeline lives in ``data.roadmap_pipeline`` because Stage 14C plans the
    same route twice for a single request, and the response shape here is the
    optimizer's own: ``{budget_hours, roadmap}``, unchanged.

    ``completed_skills`` are the learner's own assertions and are appended to the
    resume text by the server, using the same join ``POST /skill-completion``
    uses. That is what keeps a completion and every later re-plan — a moved time
    dial, a changed role — planned from one skill state instead of two. With the
    field absent, which is every request that predates this, the plan is built
    from ``resume_text`` exactly as before.
    """
    try:
        result = plan_roadmap(
            resume_text=resume_text_with_assertions(
                payload.resume_text, payload.completed_skills
            ),
            jd_text=payload.jd_text,
            budget_hours=payload.budget_hours,
            target_role=payload.target_role,
        )
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

    return RoadmapResponse(
        budget_hours=result["budget_hours"],
        roadmap=result["roadmap"],
    )


@app.post("/skill-completion", response_model=SkillCompletionResponse)
def create_skill_completion(payload: SkillCompletionRequest) -> SkillCompletionResponse:
    """Compare one route against itself around a learner-asserted completion.

    The learner asserts a skill is complete. This plans the route from their own
    text, appends the asserted skill, plans again through the same pipeline
    ``POST /roadmap`` uses, and measures the gap-closure delta between the two
    with the Stage 14A engine. Both plans are returned so the comparison can be
    read against them.

    Nothing is verified and nothing is scored about a person: the completion is
    self-reported, the delta is model-internal, and ``completion_source`` /
    ``verification_status`` say so on every response. A blank skill, a skill
    already asserted, or a skill the job description records no signal for is a
    422 rather than an estimate.
    """
    try:
        result = build_skill_completion_comparison(
            resume_text=payload.resume_text,
            jd_text=payload.jd_text,
            budget_hours=payload.budget_hours,
            skill=payload.skill,
            completed_skills=payload.completed_skills,
            target_role=payload.target_role,
        )
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
    except CompletionInputError as error:
        raise HTTPException(
            status_code=422,
            detail={"message": str(error)},
        ) from error

    return SkillCompletionResponse(**result)


@app.post("/cohort-analysis")
def create_cohort_analysis(payload: CohortAnalysisRequest) -> dict[str, object]:
    """Aggregate one submitted cohort against one role's recorded market baseline.

    The cohort is the caller's own records and is held only for this request. The
    market side is the prepared static baseline, read through the same builder as
    ``GET /curriculum-intelligence/{role}``, and the live sample is never merged
    into it: three live postings cannot carry a share of postings naming a skill.
    """
    try:
        return build_cohort_analysis(payload.cohort, target_role=payload.target_role)
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
    except CohortInputError as error:
        raise HTTPException(
            status_code=422,
            detail={"message": str(error)},
        ) from error


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


@app.get("/market-demand")
def get_market_demand() -> dict[str, object]:
    """Serve the prepared market baseline and the live freshness layer, apart.

    ``skills`` and ``roles`` are the finalized artifacts: one prepared static
    baseline, and the ranking the product already showed. ``fresh_signals`` are
    individual recent observations from ``live_postings.csv``, published one by
    one with no count, share, percentage or trend, because a sample this size
    cannot carry one. The two are never merged, and no live row changes a
    prepared figure.

    ``live_data_last_updated`` is the newest posting date the live file records,
    which is ``null`` when there is no live file yet. It is an observed date, not
    a claim about when a scrape ran.
    """
    try:
        return build_market_demand()
    except LivePostingsError as error:
        raise HTTPException(
            status_code=500,
            detail={"message": str(error)},
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



@app.get('/calibration/{role}')
def get_calibration(role: str) -> dict[str, object]:
    try:
        normalized_role = validate_target_role(role)
    except UnknownTargetRoleError as error:
        raise HTTPException(
            status_code=422,
            detail={
                'message': str(error),
                'valid_roles': list(error.valid_roles),
            },
        ) from error
    except UnplannableTargetRoleError as error:
        raise HTTPException(
            status_code=422,
            detail={
                'message': str(error),
                'plannable_roles': list(error.plannable_roles),
            },
        ) from error

    calibration_records = []
    not_available = ['calibration_records']
    provenance = {
        'boundary': 'MODEL-INTERNAL CALIBRATION (gap-closure delta). NOT a real learner outcome.',
        'measure': 'model_internal_gap_closure_delta',
        'engine': 'backend.engines.signal_engine',
        'not_a_measure_of': list(CALIBRATION_NOT_AVAILABLE),
        'note': 'This is a deterministic model-internal gap-closure delta. No learner-specific before/after record is available.',
    }

    return {
        'role': normalized_role,
        'calibration_records': [],
        'provenance': provenance,
        'not_available': not_available,
        'is_synthetic': False,
    }
