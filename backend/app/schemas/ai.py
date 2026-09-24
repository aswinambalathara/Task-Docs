from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SummarizeRequest(BaseModel):
    task_ids: list[str] | None = Field(
        None, description="List of task IDs to synthesize. Defaults to all recently completed tasks."
    )
    api_key: str | None = Field(
        None, description="Optional user-supplied Gemini API key (BYOK)"
    )
    custom_context: str | None = Field(
        None, description="Additional context or sprint theme to guide the summary"
    )
    mode: Literal["weekly", "monthly"] = Field(
        "weekly", description="Cadence mode: weekly rollup or monthly appraisal dossier"
    )


class SummarizeResponse(BaseModel):
    executive_summary: str = Field(..., description="Generated 2-sentence summary + 3 bullet points")
    source: Literal["gemini-2.0-flash", "deterministic_fallback"] = Field(
        ..., description="Engine used to generate the summary"
    )
    task_count: int
    generated_at: datetime
