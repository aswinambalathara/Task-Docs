from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import DeveloperTaskType

TaskStatus = Literal["todo", "in_progress", "done", "blocked", "cancelled"]
TaskPriority = Literal["low", "medium", "high", "urgent"]
TaskType = DeveloperTaskType


class ContributionCreate(BaseModel):
    note: str = Field(..., min_length=1, description="Engineering log or contribution note")


class ContributionResponse(BaseModel):
    note: str
    logged_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    title: str = Field(
        ..., min_length=1, max_length=250, description="Contribution: What did you do?"
    )
    date: datetime | None = Field(None, description="Date of the contribution, defaults to now")
    description: str | None = Field(None, max_length=2000, description="Detailed context")
    status: TaskStatus = Field("todo", description="Initial status")
    priority: TaskPriority = Field("medium", description="Priority level")
    type: TaskType = Field("Feature", description="Category of contribution")
    project: str = Field("General", description="Project or repository name")
    area: str | None = Field(None, description="Technical area: e.g. Auth, Enrichment, UI")
    requested_by: str | None = Field(
        None, description="Requested by (person/team) or Self-initiated"
    )
    outcome: str | None = Field(None, description="What changed? Result or impact of the work")
    evidence: str | None = Field(
        None, description="Verifiable proof: PR #, commit, ticket, deployment"
    )
    is_career_highlight: bool = Field(False, description="Flag for review cycles and brag sheets")
    tags: list[str] = Field(default_factory=list, description="Categorization tags")
    initial_contribution: str | None = Field(None, description="Optional starting work note")
    custom_fields: dict[str, Any] = Field(
        default_factory=dict, description="Forward-compatible dynamic fields"
    )


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=250)
    date: datetime | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    type: TaskType | None = None
    project: str | None = None
    area: str | None = None
    requested_by: str | None = None
    outcome: str | None = None
    evidence: str | None = None
    is_career_highlight: bool | None = None
    synced_to_docs: bool | None = None
    tags: list[str] | None = None
    contribution_note: str | None = Field(
        None, description="Append a new contribution log during update"
    )
    custom_fields: dict[str, Any] | None = None


class TaskResponse(BaseModel):
    id: str
    user_id: str
    date: datetime
    title: str
    description: str | None = None
    status: TaskStatus
    priority: TaskPriority
    type: TaskType
    project: str = "General"
    area: str | None = None
    requested_by: str | None = None
    outcome: str | None = None
    evidence: str | None = None
    is_career_highlight: bool = False
    contributions: list[ContributionResponse] = Field(default_factory=list)
    synced_to_docs: bool = False
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    custom_fields: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int = 1
    limit: int = 50
