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
