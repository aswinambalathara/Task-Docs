from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class SummarizeRequest(BaseModel):
    task_ids: list[str] | None = Field(
        None,
        max_length=500,
        description=(
            "Task IDs to synthesize. Defaults to the tasks of the current week (weekly mode) "
            "or month (monthly mode), the same tasks a summary sync writes about."
        ),
    )
    api_key: str | None = Field(None, description="Optional user-supplied Gemini API key (BYOK)")
    custom_context: str | None = Field(
        None,
        max_length=1000,
        description="Additional context or sprint theme to guide the summary",
    )
    mode: Literal["weekly", "monthly", "weekly_rollup", "monthly_appraisal"] = Field(
        "weekly", description="Cadence mode: weekly rollup or monthly appraisal dossier"
    )

    @field_validator("mode", mode="before")
    @classmethod
    def normalize_mode(cls, v: str) -> str:
        if v in ["weekly_rollup", "weekly"]:
            return "weekly"
        if v in ["monthly_appraisal", "monthly"]:
            return "monthly"
        return v


class SummarizeResponse(BaseModel):
    executive_summary: str = Field(
        ..., description="Generated 2-sentence summary + 3 bullet points"
    )
    source: Literal["gemini-2.0-flash", "gemini-2.5-flash", "deterministic_fallback"] = Field(
        ..., description="Engine used to generate the summary"
    )
    task_count: int
    generated_at: datetime
    fingerprint: str = Field(
        ..., description="Identifies the summarized tasks; pass it to the sync with this text"
    )
    remaining_previews: int | None = Field(
        None, description="AI previews left today; null when the request used the caller's own key"
    )


class PreviewQuotaResponse(BaseModel):
    limit: int
    remaining: int
    resets_at: datetime
