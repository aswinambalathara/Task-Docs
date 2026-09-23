from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ContributionCreate(BaseModel):
    note: str = Field(..., min_length=1, description="Engineering log or contribution note")


class ContributionResponse(BaseModel):
    note: str
    logged_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: str | None = Field(None, max_length=2000, description="Detailed description")
    status: Literal["todo", "in_progress", "done"] = Field("todo", description="Initial status")
    priority: Literal["low", "medium", "high", "urgent"] = Field(
        "medium", description="Priority level"
    )
    tags: list[str] = Field(default_factory=list, description="Categorization tags")
    initial_contribution: str | None = Field(None, description="Optional starting work note")


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    status: Literal["todo", "in_progress", "done"] | None = None
    priority: Literal["low", "medium", "high", "urgent"] | None = None
    synced_to_docs: bool | None = None
    tags: list[str] | None = None
    contribution_note: str | None = Field(
        None, description="Append a new contribution log during update"
    )


class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: str | None = None
    status: Literal["todo", "in_progress", "done"]
    priority: Literal["low", "medium", "high", "urgent"]
    contributions: list[ContributionResponse] = Field(default_factory=list)
    synced_to_docs: bool = False
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int = 1
    limit: int = 50
