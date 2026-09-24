from datetime import UTC, datetime
from typing import Any, Literal

from beanie import PydanticObjectId

from app.models.task import Contribution, Task
from app.schemas.task import TaskCreate, TaskPriority, TaskStatus, TaskType, TaskUpdate


class TaskService:
    """
    Pure business logic and database access layer for tasks, contributions, and career highlights.
    Guarantees strict multi-tenancy by scoping all queries to user_id.
    """

    @staticmethod
    async def create_task(user_id: str, payload: TaskCreate) -> Task:
        """
        Creates a new impact task scoped to the user with optional initial contribution.
        """
        contributions = []
        if payload.initial_contribution:
            contributions.append(Contribution(note=payload.initial_contribution))

        now = datetime.now(UTC)
        task = Task(
            user_id=user_id,
            date=payload.date or now,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            type=payload.type,
            project=payload.project,
            area=payload.area,
            requested_by=payload.requested_by,
            outcome=payload.outcome,
            evidence=payload.evidence,
            is_career_highlight=payload.is_career_highlight,
            tags=payload.tags,
            contributions=contributions,
            custom_fields=payload.custom_fields,
            created_at=now,
            updated_at=now,
        )
        await task.insert()
        if task.status == "done":
            try:
                from app.services.google_docs import GoogleDocsService

                await GoogleDocsService.sync_task_realtime(user_id=user_id, task=task)
            except Exception:
                pass
        return task

    @staticmethod
    async def list_tasks(
        user_id: str,
        status_filter: TaskStatus | Literal["all"] | None = None,
        priority_filter: TaskPriority | Literal["all"] | None = None,
        type_filter: TaskType | Literal["all"] | None = None,
        project_filter: str | None = None,
        is_career_highlight_filter: bool | None = None,
        search: str | None = None,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[list[Task], int]:
        """
        Retrieves paginated tasks with filtering and search. Returns (items, total_count).
        """
        query: dict[str, Any] = {"user_id": user_id}

        # 1. Exact-match filters (ignore None and "all")
        filter_map = {
            "status": status_filter,
            "priority": priority_filter,
            "type": type_filter,
            "project": project_filter,
        }
        for field, val in filter_map.items():
            if val and val != "all":
                query[field] = val

        # 2. Boolean filter
        if is_career_highlight_filter is not None:
            query["is_career_highlight"] = is_career_highlight_filter

        # 3. Dynamic multi-field search across textual attributes
        if search:
            search_fields = ["title", "description", "outcome", "evidence", "project", "area"]
            query["$or"] = [
                *[{field: {"$regex": search, "$options": "i"}} for field in search_fields],
                {"tags": {"$elemMatch": {"$regex": search, "$options": "i"}}},
            ]

        total = await Task.find(query).count()
        skip = (page - 1) * limit
        tasks = await Task.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
        return tasks, total

    @staticmethod
    async def get_task_by_id(task_id: str, user_id: str) -> Task | None:
        """
        Finds a task by ID ensuring multi-tenant isolation.
        """
        try:
            obj_id = PydanticObjectId(task_id)
        except Exception:
            return None

        return await Task.find_one({"_id": obj_id, "user_id": user_id})

    @staticmethod
    async def update_task(task_id: str, user_id: str, payload: TaskUpdate) -> Task | None:
        """
        Updates task fields and optionally appends a contribution note.
        """
        task = await TaskService.get_task_by_id(task_id, user_id)
        if not task:
            return None

        update_data = payload.model_dump(exclude_unset=True, exclude={"contribution_note"})
        for field, value in update_data.items():
            setattr(task, field, value)

        if payload.contribution_note:
            task.contributions.append(Contribution(note=payload.contribution_note))

        task.updated_at = datetime.now(UTC)
        await task.save()
        if task.status == "done" and not task.synced_to_docs:
            try:
                from app.services.google_docs import GoogleDocsService

                await GoogleDocsService.sync_task_realtime(user_id=user_id, task=task)
            except Exception:
                pass
        return task

    @staticmethod
    async def delete_task(task_id: str, user_id: str) -> bool:
        """
        Deletes a task by ID if owned by user_id. Returns True if deleted, False otherwise.
        """
        task = await TaskService.get_task_by_id(task_id, user_id)
        if not task:
            return False

        await task.delete()
        return True

    @staticmethod
    async def add_contribution(task_id: str, user_id: str, note: str) -> Task | None:
        """
        Appends an engineering contribution note to an existing task.
        """
        task = await TaskService.get_task_by_id(task_id, user_id)
        if not task:
            return None

        task.contributions.append(Contribution(note=note))
        task.updated_at = datetime.now(UTC)
        await task.save()
        return task

    @staticmethod
    async def get_tasks_for_sync(user_id: str, task_ids: list[str] | None = None) -> list[Task]:
        """
        Fetches tasks eligible for docs sync. If task_ids given, fetches those specific tasks.
        Otherwise fetches completed tasks or recently updated active tasks.
        """
        if task_ids:
            obj_ids = []
            for tid in task_ids:
                try:
                    obj_ids.append(PydanticObjectId(tid))
                except Exception:
                    continue
            return await Task.find({"_id": {"$in": obj_ids}, "user_id": user_id}).to_list()

        # Default: all completed tasks or tasks not yet synced
        return await Task.find({"user_id": user_id, "status": "done"}).to_list()

    @staticmethod
    async def mark_tasks_as_synced(task_ids: list[str], user_id: str) -> None:
        """
        Marks the specified tasks as synced to docs.
        """
        obj_ids = []
        for tid in task_ids:
            try:
                obj_ids.append(PydanticObjectId(tid))
            except Exception:
                continue

        if obj_ids:
            await Task.find({"_id": {"$in": obj_ids}, "user_id": user_id}).update_many(
                {"$set": {"synced_to_docs": True, "updated_at": datetime.now(UTC)}}
            )
