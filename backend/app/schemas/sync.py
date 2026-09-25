from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class GoogleAuthUrlResponse(BaseModel):
    auth_url: str = Field(..., description="Google OAuth 2.0 authorization URL")


class GoogleCallbackRequest(BaseModel):
    code: str = Field(..., min_length=1, description="OAuth authorization code returned by Google")
    state: str | None = Field(None, description="OAuth state parameter for CSRF mitigation")


class SyncCadenceResponse(BaseModel):
    daily_table_cadence: Literal["realtime", "end_of_day", "weekly"] = "realtime"
    weekly_enabled: bool = True
    weekly_day: str = "Saturday"
    monthly_enabled: bool = True
    manual_syncs_this_week: int = 0
    manual_syncs_this_month: int = 0
    max_manual_syncs_per_cycle: int = 2
    last_weekly_sync_at: datetime | None = None
    last_monthly_sync_at: datetime | None = None


class SyncCadenceUpdateRequest(BaseModel):
    daily_table_cadence: Literal["realtime", "end_of_day", "weekly"] | None = Field(
        None,
        description="Sync frequency for daily table: realtime on task done, end_of_day, or weekly",
    )
    weekly_enabled: bool | None = Field(None, description="Enable automated weekly rollup")
    weekly_day: Literal["Friday", "Saturday", "Sunday"] | None = Field(
        None, description="Day of week for rollup"
    )
    monthly_enabled: bool | None = Field(
        None, description="Enable automated month-end appraisal dossier"
    )


class IntegrationStatusResponse(BaseModel):
    connected: bool = Field(..., description="True if user has connected Google Docs")
    target_doc_id: str | None = Field(None, description="Google Doc ID configured for sync")
    target_doc_title: str | None = Field(None, description="Title of the target Google Doc")
    updated_at: datetime | None = Field(None, description="Last update timestamp")
    cadence: SyncCadenceResponse | None = None
    remaining_manual_syncs_week: int = 2
    remaining_manual_syncs_month: int = 2


class TargetDocUpdateRequest(BaseModel):
    target_doc_id: str = Field(
        ..., min_length=1, description="Google Doc ID or full Google Doc URL"
    )

    @field_validator("target_doc_id")
    @classmethod
    def extract_doc_id(cls, v: str) -> str:
        """
        Extracts document ID from full Google Docs URL if provided:
        e.g. https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
        """
        val = v.strip()
        if "/document/d/" in val:
            parts = val.split("/document/d/")
            if len(parts) > 1:
                return parts[1].split("/")[0]
        return val


class SyncDocsRequest(BaseModel):
    task_ids: list[str] | None = Field(
        None, description="Specific task IDs to sync. If omitted, syncs completed/recent tasks."
    )
    cadence_type: Literal["daily_table", "weekly_summary", "monthly_dossier", "all"] = Field(
        default="all",
        description="Structure to sync: daily table, weekly rollup, monthly dossier, or all",
    )
    executive_summary: str | None = Field(
        None, description="Optional custom or AI-drafted executive summary"
    )
    include_contributions: bool = Field(
        default=True, description="Whether to include task contribution logs"
    )
    force: bool = Field(
        default=False,
        description="Bypass manual rate limiter (used by background automated cron jobs)",
    )


class SyncDocsResponse(BaseModel):
    success: bool
    doc_id: str
    synced_tasks_count: int
    doc_url: str
    synced_at: datetime
    cadence_type: str = "all"
    remaining_manual_syncs_week: int = 2
    remaining_manual_syncs_month: int = 2
    message: str = "Sprint updates synchronized successfully"
