from datetime import UTC, datetime
from typing import Annotated, Literal

import pymongo
from beanie import Document, Indexed
from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(UTC)


class GoogleTokens(BaseModel):
    access_token: str
    refresh_token: str  # Encrypted using AES-256-GCM
    expiry_date: int  # Millisecond Unix timestamp


class SyncCadence(BaseModel):
    daily_table_cadence: Literal["realtime", "end_of_day", "weekly"] = "realtime"
    weekly_enabled: bool = True
    weekly_day: Literal["Friday", "Saturday", "Sunday"] = "Saturday"
    monthly_enabled: bool = True
    manual_syncs_this_week: int = 0
    manual_syncs_this_month: int = 0
    max_manual_syncs_per_cycle: int = 2
    last_weekly_sync_at: datetime | None = None
    last_monthly_sync_at: datetime | None = None
    week_cycle_started_at: datetime = Field(default_factory=utc_now)
    month_cycle_started_at: datetime = Field(default_factory=utc_now)

    # IANA zone (e.g. "Asia/Kolkata") used for scheduling and for which day/week a task falls in
    timezone: str = "UTC"

    # Scheduled (cron) sync bookkeeping: the local period each job last completed,
    # so restarts and multiple workers never run the same period twice
    last_table_period: str | None = None  # "2026-10-12" (end_of_day) or "2026-W41" (weekly)
    last_weekly_period: str | None = None  # "2026-W41"
    last_monthly_period: str | None = None  # "2026-10"
    last_refresh_period: str | None = None  # "2026-10-12": nightly stale-summary refresh
    auto_sync_failures: int = 0
    auto_sync_retry_at: datetime | None = None

    # Background (unattended) sync health, shown in the dashboard and MCP tool output.
    # Set when a realtime or scheduled sync fails; cleared by the next successful sync.
    table_sync_pending: bool = False  # a failed realtime table sync the scheduler must retry
    last_sync_error: str | None = None
    last_sync_error_at: datetime | None = None
    # False when the user must act (reconnect Google, pick a doc) before a retry can work
    last_sync_error_retryable: bool = True


class SummaryMeta(BaseModel):
    """What a cached summary was written about, to detect when its period's tasks change."""

    fingerprint: str  # summary_periods.fingerprint() of the summarized task IDs
    task_count: int | None = None  # None when the text came from a client preview
    generated_at: datetime = Field(default_factory=utc_now)


class Integration(Document):
    user_id: Annotated[str, Indexed()]  # Clerk user ID
    provider: Literal["google_docs"] = "google_docs"
    target_doc_id: str = ""  # Google Doc ID extracted from URL (set after OAuth or configured)
    target_doc_title: str | None = None
    google_tokens: GoogleTokens
    cadence: SyncCadence = Field(default_factory=SyncCadence)
    cached_summaries: dict[str, str] = Field(default_factory=dict)
    # Same keys as cached_summaries ("weekly:2026:10:2", "monthly:2026:10")
    summary_meta: dict[str, SummaryMeta] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "integrations"
        indexes = [[("user_id", pymongo.ASCENDING), ("provider", pymongo.ASCENDING)]]
