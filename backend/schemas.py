from typing import Any

from pydantic import BaseModel, Field


class RoadmapRequest(BaseModel):
    """One planning request.

    ``completed_skills`` are the skills the learner has asserted complete in
    this session, added by Stage 14C. The server appends them to
    ``resume_text`` itself rather than trusting the caller to compose the text,
    so a completion and every later re-plan are planned from the same skill
    state. It defaults to empty, so a request that says nothing about completions
    is planned from ``resume_text`` alone.
    """

    resume_text: str
    jd_text: str
    budget_hours: int = Field(ge=0)
    target_role: str | None = None
    completed_skills: list[str] = Field(default_factory=list)


class RoadmapResponse(BaseModel):
    budget_hours: int
    roadmap: list[Any] = Field(default_factory=list)


class SkillCompletionRequest(BaseModel):
    """One learner-asserted skill completion, measured against its own plans.

    ``resume_text`` is the learner's own submitted text and ``completed_skills``
    are the skills they asserted earlier in the session, because each completion
    is compared against the context that came before it. The server appends
    ``skill`` to those two and plans both sides itself, so the comparison cannot
    be built from a resume and an assertion list that disagree.
    """

    resume_text: str
    jd_text: str
    budget_hours: int = Field(ge=0)
    skill: str
    completed_skills: list[str] = Field(default_factory=list)
    target_role: str | None = None


class SkillCompletionResponse(BaseModel):
    """The before and after plans, and the model-internal delta between them.

    This is a model-internal comparison after a self-reported completion. It is
    not a learner outcome: ``completion_source`` and ``verification_status``
    state that nothing was assessed and nothing was verified.
    """

    skill: str
    completion_source: str
    verification_status: str
    before_score: float
    after_score: float
    delta: float
    predicted_gain: float
    gap_closed: bool
    gap_status: str
    gap_status_note: str
    matches_predicted_gain: bool
    # Stage 14D: the magnitude behind `matches_predicted_gain`. Optional and
    # defaulted, so a payload validated against an earlier shape still loads and
    # every pre-existing field keeps its meaning.
    model_internal_consistency_error: float | None = None
    gap_weight: float
    before_roadmap: list[Any] = Field(default_factory=list)
    after_roadmap: list[Any] = Field(default_factory=list)
    before_budget_hours: int
    after_budget_hours: int
    target_role: str | None = None
    asserted_skills: list[str] = Field(default_factory=list)
    assertion_count: int
    provenance: dict[str, Any]
    not_a_measure_of: list[str]
    is_synthetic: bool = False


class CohortStudent(BaseModel):
    """One submitted cohort record: an identifier and the skills it records.

    ``skills`` defaults to empty so a student the caller holds no skills for can
    still be counted in the cohort rather than dropped from it.
    """

    student_id: str
    skills: list[str] = Field(default_factory=list)


class CohortAnalysisRequest(BaseModel):
    """A cohort to aggregate, and the one role its skills are compared against.

    ``target_role`` is required rather than optional: the market baseline is
    recorded per role, so with no role there is no recorded market figure to
    compare the cohort against and the comparison would have to be invented.
    """

    cohort: list[CohortStudent]
    target_role: str

class CalibrationRecord(BaseModel):
    """"A single model-internal calibration record distinguishing internal calibration from real learner outcomes."""

    skill: str
    before_score: float | int
    after_score: float | int
    delta: float | int
    predicted_gain: float | int
    gap_closed: bool
    provenance: dict[str, Any]
    is_synthetic: bool


class CalibrationResponse(BaseModel):
    """"Calibration response for a role.

    This represents MODEL-INTERNAL CALIBRATION only; real learner outcomes are
    not included.
    """

    role: str
    calibration_records: list[CalibrationRecord]
    provenance: dict[str, Any]
    not_available: list[str] | None = None
    is_synthetic: bool = False
