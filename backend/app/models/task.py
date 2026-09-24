from datetime import UTC, datetime
from typing import Annotated, Any, Literal

import pymongo
from beanie import Document, Indexed
from pydantic import BaseModel, Field

from app.core.constants import DeveloperTaskType


def utc_now() -> datetime:
    return datetime.now(UTC)


class Contribution(BaseModel):
    logged_at: datetime = Field(default_factory=utc_now)
    note: str = Field(..., min_length=1)


class Task(Document):
    user_id: Annotated[str, Indexed()]  # Multi-tenant Clerk user ID (e.g., "user_2P9xYz...")

    # --- UNIVERSAL CORE IMPACT FIELDS ---
    date: datetime = Field(default_factory=utc_now, description="Execution date of work")
    title: str = Field(..., min_length=1, max_length=250, description="Contribution: What did you do?")
    description: str | None = None
    status: Literal["todo", "in_progress", "done", "blocked", "cancelled"] = "todo"
    outcome: str | None = Field(None, description="What changed because of this work?")
    evidence: str | None = Field(None, description="Verifiable proof: PR link, commit, ticket, deployment")
    is_career_highlight: bool = Field(default=False, description="Starred for performance reviews / brag sheet")

    # --- DEVELOPER TEMPLATE FIELDS ---
    project: str = Field(default="General", description="Project or repository name")
    area: str | None = Field(None, description="Technical area: e.g. Auth, Enrichment, Search Portal")
    type: DeveloperTaskType = "Feature"
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    requested_by: str | None = Field(None, description="Assigned by or Self-initiated")

    # --- WORK NOTES & METADATA ---
    contributions: list[Contribution] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    synced_to_docs: bool = False
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    # --- FORWARD-COMPATIBLE HOOK ---
    custom_fields: dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "tasks"
        indexes = [
            "user_id",
            [("user_id", pymongo.ASCENDING), ("status", pymongo.ASCENDING)],
            [("user_id", pymongo.ASCENDING), ("is_career_highlight", pymongo.ASCENDING)],
            [("user_id", pymongo.ASCENDING), ("project", pymongo.ASCENDING)],
            [("user_id", pymongo.ASCENDING), ("date", pymongo.DESCENDING)],
            [("user_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)],
        ]
