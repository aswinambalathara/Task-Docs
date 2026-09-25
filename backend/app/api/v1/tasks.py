from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import AuthenticatedUser, get_current_user
from app.models.task import Task
from app.schemas.task import (
    ContributionCreate,
    ContributionResponse,
    TaskCreate,
    TaskListResponse,
    TaskPriority,
    TaskResponse,
    TaskStatus,
    TaskType,
    TaskUpdate,
)
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _to_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=str(task.id),
        user_id=task.user_id,
        date=task.date,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        type=task.type,
        project=task.project,
        area=task.area,
        requested_by=task.requested_by,
        outcome=task.outcome,
        evidence=task.evidence,
        is_career_highlight=task.is_career_highlight,
        contributions=[
            ContributionResponse(note=c.note, logged_at=c.logged_at) for c in task.contributions
        ],
        synced_to_docs=task.synced_to_docs,
        tags=task.tags,
        created_at=task.created_at,
        updated_at=task.updated_at,
        custom_fields=task.custom_fields,
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate, current_user: AuthenticatedUser = Depends(get_current_user)
) -> TaskResponse:
    """
    Creates a new contribution/impact record scoped to the authenticated user.
    """
    task = await TaskService.create_task(user_id=current_user.id, payload=payload)
    return _to_response(task)


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status_filter: TaskStatus | Literal["all"] | None = Query(None, alias="status"),
    priority_filter: TaskPriority | Literal["all"] | None = Query(None, alias="priority"),
    type_filter: TaskType | Literal["all"] | None = Query(None, alias="type"),
    project_filter: str | None = Query(None, alias="project"),
    is_career_highlight: bool | None = Query(None, alias="highlight"),
    search: str | None = Query(
        None, description="Search across title, outcome, evidence, project, and tags"
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> TaskListResponse:
    """
    Lists tasks owned by the authenticated user with status, project, highlight, and search filters.
    """
    tasks, total = await TaskService.list_tasks(
        user_id=current_user.id,
        status_filter=status_filter,
        priority_filter=priority_filter,
        type_filter=type_filter,
        project_filter=project_filter,
        is_career_highlight_filter=is_career_highlight,
        search=search,
        page=page,
        limit=limit,
    )
    return TaskListResponse(
        items=[_to_response(t) for t in tasks], total=total, page=page, limit=limit
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str, current_user: AuthenticatedUser = Depends(get_current_user)
) -> TaskResponse:
    """
    Retrieves a single task by ID. Strict multi-tenant isolation ensures only the owner can access it.
    """
    task = await TaskService.get_task_by_id(task_id=task_id, user_id=current_user.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    return _to_response(task)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str, payload: TaskUpdate, current_user: AuthenticatedUser = Depends(get_current_user)
) -> TaskResponse:
    """
    Updates a task's properties and optionally appends a contribution note.
    """
    task = await TaskService.update_task(task_id=task_id, user_id=current_user.id, payload=payload)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    return _to_response(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Deletes a task by ID.
    """
    deleted = await TaskService.delete_task(task_id=task_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return None


@router.post("/{task_id}/contributions", response_model=TaskResponse)
async def add_contribution(
    task_id: str,
    payload: ContributionCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> TaskResponse:
    """
    Appends an engineering contribution note to an existing task.
    """
    task = await TaskService.add_contribution(
        task_id=task_id, user_id=current_user.id, note=payload.note
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    return _to_response(task)
