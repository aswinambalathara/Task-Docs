from datetime import UTC, datetime
from typing import Literal

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import AuthenticatedUser, get_current_user
from app.models.task import Contribution, Task
from app.schemas.task import (
    ContributionCreate,
    ContributionResponse,
    TaskCreate,
    TaskListResponse,
    TaskResponse,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _to_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=str(task.id),
        user_id=task.user_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        contributions=[
            ContributionResponse(note=c.note, logged_at=c.logged_at) for c in task.contributions
        ],
        synced_to_docs=task.synced_to_docs,
        tags=task.tags,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate, current_user: AuthenticatedUser = Depends(get_current_user)
) -> TaskResponse:
    """
    Creates a new engineering task scoped to the authenticated user.
    """
    contributions = []
    if payload.initial_contribution:
        contributions.append(Contribution(note=payload.initial_contribution))

    now = datetime.now(UTC)
    task = Task(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        tags=payload.tags,
        contributions=contributions,
        created_at=now,
        updated_at=now,
    )
    await task.insert()
    return _to_response(task)


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status_filter: Literal["todo", "in_progress", "done", "all"] | None = Query(
        None, alias="status"
    ),
    priority_filter: Literal["low", "medium", "high", "urgent", "all"] | None = Query(
        None, alias="priority"
    ),
    search: str | None = Query(None, description="Search across title, description, and tags"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> TaskListResponse:
    """
    Lists tasks owned by the authenticated user with optional status, priority, and search filters.
    """
    query = {"user_id": current_user.id}

    if status_filter and status_filter != "all":
        query["status"] = status_filter

    if priority_filter and priority_filter != "all":
        query["priority"] = priority_filter

    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$elemMatch": {"$regex": search, "$options": "i"}}},
        ]

    total = await Task.find(query).count()
    skip = (page - 1) * limit
    tasks = await Task.find(query).sort("-created_at").skip(skip).limit(limit).to_list()

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
    try:
        obj_id = PydanticObjectId(task_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        ) from None

    task = await Task.find_one({"_id": obj_id, "user_id": current_user.id})
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
    try:
        obj_id = PydanticObjectId(task_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        ) from None

    task = await Task.find_one({"_id": obj_id, "user_id": current_user.id})
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    update_data = payload.model_dump(exclude_unset=True, exclude={"contribution_note"})
    for field, value in update_data.items():
        setattr(task, field, value)

    if payload.contribution_note:
        task.contributions.append(Contribution(note=payload.contribution_note))

    task.updated_at = datetime.now(UTC)
    await task.save()

    return _to_response(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Deletes a task by ID.
    """
    try:
        obj_id = PydanticObjectId(task_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        ) from None

    task = await Task.find_one({"_id": obj_id, "user_id": current_user.id})
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await task.delete()
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
    try:
        obj_id = PydanticObjectId(task_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        ) from None

    task = await Task.find_one({"_id": obj_id, "user_id": current_user.id})
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.contributions.append(Contribution(note=payload.note))
    task.updated_at = datetime.now(UTC)
    await task.save()

    return _to_response(task)
