from datetime import UTC, datetime
from typing import Annotated, Literal

import pymongo
from beanie import Document, Indexed
from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(UTC)


class Contribution(BaseModel):
    logged_at: datetime = Field(default_factory=utc_now)
    note: str = Field(..., min_length=1)


class Task(Document):
    user_id: Annotated[str, Indexed()]  # Multi-tenant Clerk user ID (e.g., "user_2P9xYz...")
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    status: Literal["todo", "in_progress", "done"] = "todo"
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    contributions: list[Contribution] = Field(default_factory=list)
    synced_to_docs: bool = False
    tags: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "tasks"
        indexes = [
            "user_id",
            [("user_id", pymongo.ASCENDING), ("status", pymongo.ASCENDING)],
            [("user_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)],
        ]
