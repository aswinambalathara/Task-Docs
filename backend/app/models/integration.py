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


class Integration(Document):
    user_id: Annotated[str, Indexed()]  # Clerk user ID
    provider: Literal["google_docs"] = "google_docs"
    target_doc_id: str = ""  # Google Doc ID extracted from URL (set after OAuth or configured)
    target_doc_title: str | None = None
    google_tokens: GoogleTokens
    cadence: SyncCadence = Field(default_factory=SyncCadence)
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "integrations"
        indexes = [[("user_id", pymongo.ASCENDING), ("provider", pymongo.ASCENDING)]]
