from datetime import UTC, datetime

import pymongo
from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class AIPreviewUsage(Document):
    """
    Per-user daily counter of AI preview generations billed to the server's Gemini key.
    One document per user per UTC day; MongoDB's TTL index purges old days.
    """

    user_id: str
    day: str  # UTC date, e.g. "2026-10-12"
    used: int = 0
    created_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "ai_preview_usage"
        indexes = [
            IndexModel([("user_id", pymongo.ASCENDING), ("day", pymongo.ASCENDING)], unique=True),
            IndexModel([("created_at", pymongo.ASCENDING)], expireAfterSeconds=2 * 24 * 3600),
        ]
