"""
Daily quota for AI preview generations (POST /ai/summarize).

Previews are separate from the 2-per-cycle Google Docs sync quota: they never write to Docs,
but each one costs a Gemini call on the server's key. Counters reset at UTC midnight.
"""

import contextlib
from datetime import UTC, datetime, timedelta

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.models.ai_usage import AIPreviewUsage


class AIPreviewQuota:
    @staticmethod
    def _today(now: datetime) -> str:
        return now.strftime("%Y-%m-%d")

    @staticmethod
    def resets_at(now: datetime | None = None) -> datetime:
        now = now or datetime.now(UTC)
        return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    @classmethod
    def seconds_until_reset(cls, now: datetime | None = None) -> int:
        now = now or datetime.now(UTC)
        return max(1, int((cls.resets_at(now) - now).total_seconds()))

    @classmethod
    async def remaining(cls, user_id: str) -> int:
        limit = settings.AI_PREVIEW_DAILY_LIMIT
        doc = await AIPreviewUsage.get_motor_collection().find_one(
            {"user_id": user_id, "day": cls._today(datetime.now(UTC))}
        )
        used = doc["used"] if doc else 0
        return max(0, limit - used)

    @classmethod
    async def claim(cls, user_id: str) -> int | None:
        """
        Atomically claims one preview slot. Returns the remaining count after the claim,
        or None if today's limit is already reached.
        """
        now = datetime.now(UTC)
        limit = settings.AI_PREVIEW_DAILY_LIMIT
        collection = AIPreviewUsage.get_motor_collection()
        key = {"user_id": user_id, "day": cls._today(now)}

        # DuplicateKeyError means a concurrent request created today's counter first
        with contextlib.suppress(DuplicateKeyError):
            await collection.update_one(
                key, {"$setOnInsert": {"used": 0, "created_at": now}}, upsert=True
            )

        # The $lt filter makes check-and-increment a single atomic step, so parallel clicks
        # can never push the count past the limit
        doc = await collection.find_one_and_update(
            {**key, "used": {"$lt": limit}},
            {"$inc": {"used": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if doc is None:
            return None
        return max(0, limit - doc["used"])

    @classmethod
    async def refund(cls, user_id: str) -> int:
        """Returns a claimed slot when no Gemini call was billed (fallback or error)."""
        now = datetime.now(UTC)
        limit = settings.AI_PREVIEW_DAILY_LIMIT
        doc = await AIPreviewUsage.get_motor_collection().find_one_and_update(
            {"user_id": user_id, "day": cls._today(now), "used": {"$gt": 0}},
            {"$inc": {"used": -1}},
            return_document=ReturnDocument.AFTER,
        )
        used = doc["used"] if doc else 0
        return max(0, limit - used)
