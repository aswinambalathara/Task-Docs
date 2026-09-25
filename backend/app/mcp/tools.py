"""
Tethr FastMCP Tools.
Contains MCP tool implementations for engineering task management,
contribution logging, impact querying, and Google Docs synchronization.
"""

from typing import Any, Literal

from loguru import logger
from mcp.server.fastmcp import Context, FastMCP

from app.core.constants import DEVELOPER_TASK_TYPES, DeveloperTaskType
from app.mcp.context import get_current_mcp_user_id
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskPriority, TaskStatus, TaskUpdate
from app.services.google_docs import GoogleDocsService
from app.services.task_service import TaskService


def _format_task_summary(task: Task) -> str:
    highlight_badge = " ⭐ [CAREER HIGHLIGHT]" if task.is_career_highlight else ""
    lines = [
        f"**Task ID:** `{task.id}`{highlight_badge}",
        f"- **Title:** {task.title}",
        f"- **Project:** {task.project} | **Area:** {task.area or '—'} | **Type:** {task.type}",
        f"- **Status:** `{task.status}` | **Priority:** `{task.priority}`",
    ]
    if task.requested_by:
        lines.append(f"- **Requested By:** {task.requested_by}")
    if task.outcome:
        lines.append(f"- **Outcome:** {task.outcome}")
    if task.evidence:
        lines.append(f"- **Evidence:** {task.evidence}")
    if task.contributions:
        lines.append(f"- **Contributions Logged:** {len(task.contributions)} entry(ies)")
        latest = task.contributions[-1]
        lines.append(f"  - *Latest:* {latest.note} ({latest.logged_at.strftime('%Y-%m-%d %H:%M')})")
    lines.append(f"- **Synced to Google Docs:** {'Yes' if task.synced_to_docs else 'No'}")
    return "\n".join(lines)


async def add_task(
    title: str,
    project: str = "General",
    area: str | None = None,
    type: str = "Feature",
    status: str = "todo",
    priority: str = "medium",
    outcome: str | None = None,
    evidence: str | None = None,
    requested_by: str | None = None,
    is_career_highlight: bool = False,
    ctx: Context | None = None,
) -> str:
    """
    Creates a new impact task in Tethr.

    Args:
        title: What did you do or what needs to be done?
        project: Project or repository name (default: "General").
        area: Technical component or architectural area (e.g., "Auth", "Enrichment", "UI", "Database").
        type: Category: Feature, Bugfix, Refactoring, Performance, Testing, Documentation, DevOps, Architecture, Security, Other.
        status: Initial state: todo, in_progress, done, blocked, cancelled (default: "todo").
        priority: Priority level: low, medium, high, urgent (default: "medium").
        outcome: Measurable outcome or shipped impact (e.g., "Reduced latency by 40%").
        evidence: Verifiable proof (e.g., "PR #142", commit SHA, deployment link).
        requested_by: Requesting stakeholder, ticket ref, or "Self-initiated".
        is_career_highlight: True if this achievement is review-cycle worthy.
    """
    try:
        user_id = get_current_mcp_user_id()
    except ValueError as e:
        return f"Error: {e}"

    # Normalize type to valid DeveloperTaskType or fallback to 'Feature'
    valid_type: DeveloperTaskType = "Feature"
    for candidate in DEVELOPER_TASK_TYPES:
        if candidate.lower() == type.lower():
            valid_type = candidate
            break

    # Normalize status and priority
    norm_status: TaskStatus = "todo"
    if status in ["todo", "in_progress", "done", "blocked", "cancelled"]:
        norm_status = status  # type: ignore

    norm_priority: TaskPriority = "medium"
    if priority in ["low", "medium", "high", "urgent"]:
        norm_priority = priority  # type: ignore

    payload = TaskCreate(
        title=title,
        project=project,
        area=area,
        type=valid_type,
        status=norm_status,
        priority=norm_priority,
        outcome=outcome,
        evidence=evidence,
        requested_by=requested_by,
        is_career_highlight=is_career_highlight,
    )

    try:
        task = await TaskService.create_task(user_id=user_id, payload=payload)
        logger.info(f"MCP tool add_task created task {task.id} for user {user_id}")
        return f"✅ **Task Created Successfully!**\n\n{_format_task_summary(task)}"
    except Exception as exc:
        logger.error(f"MCP add_task error: {exc}")
        return f"Error creating task: {str(exc)}"


async def update_task(
    task_id: str,
    status: str | None = None,
    outcome: str | None = None,
    evidence: str | None = None,
    contribution_note: str | None = None,
    is_career_highlight: bool | None = None,
    ctx: Context | None = None,
) -> str:
    """
    Updates an existing task in Tethr. Can also append an engineering contribution note.

    Args:
        task_id: The unique MongoDB ID of the task to update.
        status: New state: todo, in_progress, done, blocked, cancelled.
        outcome: Updated business or technical outcome description.
        evidence: Updated verifiable proof (e.g. PR URL, commit hash).
        contribution_note: Optional note to append to the task's engineering log history.
        is_career_highlight: Set to true if this task should be flagged for career appraisal.
    """
    try:
        user_id = get_current_mcp_user_id()
    except ValueError as e:
        return f"Error: {e}"

    norm_status: TaskStatus | None = None
    if status and status in ["todo", "in_progress", "done", "blocked", "cancelled"]:
        norm_status = status  # type: ignore

    update_kwargs: dict[str, Any] = {}
    if norm_status is not None:
        update_kwargs["status"] = norm_status
    if outcome is not None:
        update_kwargs["outcome"] = outcome
    if evidence is not None:
        update_kwargs["evidence"] = evidence
    if contribution_note is not None:
        update_kwargs["contribution_note"] = contribution_note
    if is_career_highlight is not None:
        update_kwargs["is_career_highlight"] = is_career_highlight

    payload = TaskUpdate(**update_kwargs)

    try:
        task = await TaskService.update_task(task_id=task_id, user_id=user_id, payload=payload)
        if not task:
            return f"❌ **Error:** Task `{task_id}` not found or you do not have permission to modify it."

        logger.info(f"MCP tool update_task updated task {task_id} for user {user_id}")
        return f"✅ **Task `{task_id}` Updated Successfully!**\n\n{_format_task_summary(task)}"
    except Exception as exc:
        logger.error(f"MCP update_task error: {exc}")
        return f"Error updating task: {str(exc)}"


async def get_tasks(
    status: str | None = None,
    project: str | None = None,
    is_career_highlight: bool | None = None,
    limit: int = 20,
    ctx: Context | None = None,
) -> str:
    """
    Retrieves engineering tasks from Tethr filtered by status, project, or career highlight.

    Args:
        status: Filter by status ('todo', 'in_progress', 'done', 'blocked', 'cancelled', or None for all).
        project: Filter by project name (e.g. 'Tethr', 'General').
        is_career_highlight: If True, only returns review-worthy career highlight tasks.
        limit: Maximum number of tasks to return (default: 20).
    """
    try:
        user_id = get_current_mcp_user_id()
    except ValueError as e:
        return f"Error: {e}"

    norm_status: TaskStatus | Literal["all"] | None = None
    if status and status in ["todo", "in_progress", "done", "blocked", "cancelled", "all"]:
        norm_status = status  # type: ignore

    try:
        tasks, total = await TaskService.list_tasks(
            user_id=user_id,
            status_filter=norm_status,
            project_filter=project,
            is_career_highlight_filter=is_career_highlight,
            limit=limit,
        )

        if not tasks:
            filter_desc = []
            if status:
                filter_desc.append(f"status='{status}'")
            if project:
                filter_desc.append(f"project='{project}'")
            if is_career_highlight is not None:
                filter_desc.append(f"is_career_highlight={is_career_highlight}")
            filter_str = f" with filters ({', '.join(filter_desc)})" if filter_desc else ""
            return f"📋 No tasks found{filter_str} for user `{user_id}`."

        header = f"### 📋 Tethr Tasks ({len(tasks)} of {total} total)\n"
        items_text = "\n\n---\n\n".join([_format_task_summary(t) for t in tasks])
        return f"{header}\n{items_text}"
    except Exception as exc:
        logger.error(f"MCP get_tasks error: {exc}")
        return f"Error fetching tasks: {str(exc)}"


async def sync_docs(ctx: Context | None = None) -> str:
    """
    Batches completed tasks and achievements from the impact ledger and triggers synthesis
    into the user's connected Google Doc via GoogleDocsService.
    """
    try:
        user_id = get_current_mcp_user_id()
    except ValueError as e:
        return f"Error: {e}"

    try:
        result = await GoogleDocsService.sync_sprint_to_doc(
            user_id=user_id,
            cadence_type="all",
            force=False,
        )
        return (
            f"📄 **Google Docs Sync Successful!**\n\n"
            f"- **Document:** [{result.get('doc_id')}]({result.get('doc_url')})\n"
            f"- **Tasks Synced:** {result.get('synced_tasks_count')} tasks\n"
            f"- **Remaining Manual Syncs This Week:** {result.get('remaining_manual_syncs_week')}\n"
            f"- **Remaining Manual Syncs This Month:** {result.get('remaining_manual_syncs_month')}\n\n"
            f"View your formatted impact dossier directly in Google Docs: {result.get('doc_url')}"
        )
    except ValueError as ve:
        # User-friendly error such as rate limit reached or missing doc ID
        return f"⚠️ **Sync Notice:** {str(ve)}"
    except Exception as exc:
        logger.error(f"MCP sync_docs error: {exc}")
        return f"❌ **Error syncing to Google Docs:** {str(exc)}"


def register_tools(mcp_instance: FastMCP) -> None:
    """
    Registers all Tethr MCP tools onto a FastMCP server instance.
    """
    mcp_instance.add_tool(add_task)
    mcp_instance.add_tool(update_task)
    mcp_instance.add_tool(get_tasks)
    mcp_instance.add_tool(sync_docs)
