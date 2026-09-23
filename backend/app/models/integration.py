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


class Integration(Document):
    user_id: Annotated[str, Indexed()]  # Clerk user ID
    provider: Literal["google_docs"] = "google_docs"
    target_doc_id: str  # Google Doc ID extracted from URL
    google_tokens: GoogleTokens
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "integrations"
        indexes = [[("user_id", pymongo.ASCENDING), ("provider", pymongo.ASCENDING)]]
