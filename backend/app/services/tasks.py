from datetime import UTC, datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo

from beanie import PydanticObjectId

from app.core.logger import logger
from app.core.timezones import get_zone, is_valid_timezone
from app.models.integration import Integration
from app.models.task import Contribution, Task
from app.schemas.task import TaskCreate, TaskPriority, TaskStatus, TaskType, TaskUpdate


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _schedule_realtime_sync_if_done(user_id: str, task: Task) -> None:
    """
    Completed tasks are pushed to the Google Doc in the background when the user's
    daily table cadence is "realtime" (checked inside the sync).
    """
    if task.status != "done":
        return
    from app.services import docs

    try:
        docs.realtime.schedule_realtime_sync(user_id)
    except Exception as exc:
        logger.warning(f"Could not schedule realtime docs sync for user {user_id}: {exc}")


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
        now = datetime.now(UTC)
        work_date = _aware(payload.date) if payload.date else now
        # A backdated task's first note and completion belong to its work date, not to now
        happened_at = min(work_date, now)

        contributions = []
        if payload.initial_contribution:
            contributions.append(
                Contribution(note=payload.initial_contribution, logged_at=happened_at)
            )

        completed_at = None
        if payload.status == "done":
            completed_at = _aware(payload.completed_at) if payload.completed_at else happened_at

        task = Task(
            user_id=user_id,
            date=work_date,
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
            completed_at=completed_at,
            created_at=now,
            updated_at=now,
        )
        await task.insert()
        _schedule_realtime_sync_if_done(user_id, task)
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
        active_from: datetime | None = None,
        active_to: datetime | None = None,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[list[Task], int]:
        """
        Retrieves paginated tasks with filtering and search. Returns (items, total_count).
        active_from/active_to ([start, end), UTC) keep tasks with activity in that window: their
        work date, completion or a logged contribution. Creation and edits don't count, so a
        backdated task belongs to its work date and a title fix isn't progress.
        """
        query: dict[str, Any] = {"user_id": user_id}
        conditions: list[dict[str, Any]] = []

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
            conditions.append({"$or": [
                *[{field: {"$regex": search, "$options": "i"}} for field in search_fields],
                {"tags": {"$elemMatch": {"$regex": search, "$options": "i"}}},
            ]})

        # 4. Activity window
        if active_from or active_to:
            window: dict[str, datetime] = {}
            if active_from:
                window["$gte"] = active_from
            if active_to:
                window["$lt"] = active_to
            conditions.append({"$or": [
                {"date": window},
                {"completed_at": window},
                {"contributions": {"$elemMatch": {"logged_at": window}}},
            ]})

        if conditions:
            query["$and"] = conditions

        total = await Task.find(query).count()
        skip = (page - 1) * limit
        tasks = await Task.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
        return tasks, total

    @staticmethod
    async def user_zone(user_id: str, override: str | None = None) -> ZoneInfo:
        """Zone for date filters: a valid override, else the Docs integration's, else UTC."""
        if override and is_valid_timezone(override):
            return ZoneInfo(override)
        integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
        return get_zone(integration.cadence.timezone if integration else None)

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

        was_done = task.status == "done"
        update_data = payload.model_dump(
            exclude_unset=True, exclude={"contribution_note", "synced_to_docs"}
        )
        for field, value in update_data.items():
            if field == "is_career_highlight" and value is None:
                continue
            setattr(task, field, value)

        # completed_at tracks the latest finish: set when the task becomes done, cleared if reopened
        if task.status != "done":
            task.completed_at = None
        elif (not was_done and "completed_at" not in update_data) or task.completed_at is None:
            task.completed_at = datetime.now(UTC)

        if payload.contribution_note:
            task.contributions.append(Contribution(note=payload.contribution_note))

        # Any content or status update marks task as unsynced
        task.synced_to_docs = False
        task.updated_at = datetime.now(UTC)
        await task.save()
        _schedule_realtime_sync_if_done(user_id, task)
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
        task.synced_to_docs = False
        task.updated_at = datetime.now(UTC)
        await task.save()
        _schedule_realtime_sync_if_done(user_id, task)
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

        # 1. Prioritize tasks not yet synced to Google Docs
        unsynced = await Task.find({"user_id": user_id, "synced_to_docs": False}).sort("-date").to_list()
        if unsynced:
            return unsynced

        # 2. Fallback to all completed tasks
        return await Task.find({"user_id": user_id, "status": "done"}).sort("-date").to_list()

    @staticmethod
    async def mark_tasks_as_synced(
        task_ids: list[str], user_id: str, unchanged_since: datetime | None = None
    ) -> None:
        """
        Marks the specified tasks as synced to docs. With unchanged_since, tasks updated
        after that moment are skipped so their newer content is picked up by the next sync.
        """
        obj_ids = []
        for tid in task_ids:
            try:
                obj_ids.append(PydanticObjectId(tid))
            except Exception:
                continue

        if obj_ids:
            query: dict[str, Any] = {"_id": {"$in": obj_ids}, "user_id": user_id}
            if unchanged_since is not None:
                query["updated_at"] = {"$lte": unchanged_since}
            # updated_at is left alone: syncing isn't an edit, and the activity filter relies on it
            await Task.find(query).update_many({"$set": {"synced_to_docs": True}})
