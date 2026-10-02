from typing import Any

from pydantic import BaseModel, Field


class RoadmapRequest(BaseModel):
    resume_text: str
    jd_text: str
    budget_hours: int = Field(ge=0)
    target_role: str | None = None


class RoadmapResponse(BaseModel):
    budget_hours: int
    roadmap: list[Any] = Field(default_factory=list)


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
