"""
Tethr FastMCP Tools.
Contains MCP tool implementations for engineering task management,
contribution logging, impact querying, and Google Docs synchronization.
"""

from typing import Annotated, Any, Literal

from loguru import logger
from mcp.server.fastmcp import Context, FastMCP
from pydantic import Field

from app.core.constants import (
    DESCRIPTION_MAX_CHARS,
    DEVELOPER_TASK_TYPES,
    EVIDENCE_MAX_CHARS,
    OUTCOME_MAX_CHARS,
    DeveloperTaskType,
)
from app.mcp import formatting
from app.mcp.context import get_current_mcp_user_id
from app.schemas.task import TaskCreate, TaskPriority, TaskStatus, TaskUpdate
from app.services import docs
from app.services.tasks import TaskService

# sync_docs `summaries` option -> sync cadence_type
SUMMARY_SCOPES: dict[str, Literal["daily_table", "weekly_summary", "monthly_dossier", "all"]] = {
    "none": "daily_table",
    "weekly": "weekly_summary",
    "monthly": "monthly_dossier",
    "both": "all",
}

# Outcome and Evidence become Google Doc table cells, so they must stay short. The limits are
# published in the tool schema (maxLength) so agents see them before calling, and checked in
# the tool so an over-long value gets an explanation instead of a bare validation error.
OUTCOME_HELP = (
    f"One sentence, at most {OUTCOME_MAX_CHARS} characters: the result of the work, not how "
    'you got there (e.g. "Restored the portal sidebar in production"). '
    "Put the investigation and details in `description`."
)
EVIDENCE_HELP = (
    f"References only, at most {EVIDENCE_MAX_CHARS} characters: PR number, commit SHA, branch "
    'or link (e.g. "PR #142, commit eb05be0d"). No explanations.'
)
DESCRIPTION_HELP = (
    f"Optional full story, at most {DESCRIPTION_MAX_CHARS} characters: root cause, approach, "
    "trade-offs, anything too long for `outcome` or `evidence`. Not shown in the Google Doc table."
)

OutcomeArg = Annotated[
    str | None,
    Field(description=OUTCOME_HELP, json_schema_extra={"maxLength": OUTCOME_MAX_CHARS}),
]
EvidenceArg = Annotated[
    str | None,
    Field(description=EVIDENCE_HELP, json_schema_extra={"maxLength": EVIDENCE_MAX_CHARS}),
]
DescriptionArg = Annotated[
    str | None,
    Field(description=DESCRIPTION_HELP, json_schema_extra={"maxLength": DESCRIPTION_MAX_CHARS}),
]

FIELD_LIMITS = {
    "outcome": OUTCOME_MAX_CHARS,
    "evidence": EVIDENCE_MAX_CHARS,
    "description": DESCRIPTION_MAX_CHARS,
}


def length_error(tool_name: str, **fields: str | None) -> str | None:
    """
    Explains to the agent which of outcome / evidence / description is too long and how to
    fix it, or returns None when everything fits.
    """
    problems = [
        f"- `{name}` is {len(value)} characters (limit {FIELD_LIMITS[name]})"
        for name, value in fields.items()
        if value is not None and len(value) > FIELD_LIMITS[name]
    ]
    if not problems:
        return None
    return (
        "❌ **Not saved: some fields are too long for the Google Docs ledger.**\n"
        + "\n".join(problems)
        + "\n\nHow to fix:\n"
        f"- `outcome`: one sentence about the result, at most {OUTCOME_MAX_CHARS} characters.\n"
        f"- `evidence`: references only (PR, commit SHA, branch, link), "
        f"at most {EVIDENCE_MAX_CHARS} characters.\n"
        f"- Move the details into `description` (at most {DESCRIPTION_MAX_CHARS} characters) "
        "or `contribution_note`.\n"
        f"Then call `{tool_name}` again."
    )


async def add_task(
    title: str,
    project: str = "General",
    area: str | None = None,
    type: str = "Feature",
    status: str = "todo",
    priority: str = "medium",
    outcome: OutcomeArg = None,
    evidence: EvidenceArg = None,
    description: DescriptionArg = None,
    requested_by: str | None = None,
    is_career_highlight: bool = False,
    ctx: Context | None = None,
) -> str:
    """
    Creates a new impact task in Tethr. Each task becomes one row of the user's Google Docs
    ledger table, so keep `outcome` and `evidence` short and put the full story in
    `description`.

    Args:
        title: What did you do or what needs to be done? One line.
        project: Project or repository name (default: "General").
        area: Technical component or architectural area (e.g., "Auth", "Enrichment", "UI", "Database").
        type: Category: Feature, Bug Fix, Improvement, Investigation, Research / POC, Performance, Infrastructure, AI / LLM, UI / UX, Data.
        status: Initial state: todo, in_progress, done, blocked, cancelled (default: "todo").
        priority: Priority level: low, medium, high, urgent (default: "medium").
        outcome: One sentence (max 160 chars): the result, e.g. "Reduced latency by 40%".
        evidence: References only (max 120 chars): PR number, commit SHA, branch or link.
        description: Optional full story (max 2000 chars): root cause, approach, details.
        requested_by: Requesting stakeholder, ticket ref, or "Self-initiated".
        is_career_highlight: True if this achievement is review-cycle worthy.
    """
    try:
        user_id = get_current_mcp_user_id()
    except ValueError as e:
        return f"Error: {e}"

    if error := length_error(
        "add_task", outcome=outcome, evidence=evidence, description=description
    ):
        return error

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
        description=description,
        requested_by=requested_by,
        is_career_highlight=is_career_highlight,
    )

    try:
        task = await TaskService.create_task(user_id=user_id, payload=payload)
        logger.info(f"MCP tool add_task created task {task.id} for user {user_id}")
        return await formatting.with_health_note(
            user_id, f"✅ **Task Created Successfully!**\n\n{formatting.format_task_summary(task)}"
        )
    except Exception as exc:
        logger.error(f"MCP add_task error: {exc}")
        return f"Error creating task: {str(exc)}"


async def update_task(
    task_id: str,
    status: str | None = None,
    outcome: OutcomeArg = None,
    evidence: EvidenceArg = None,
    description: DescriptionArg = None,
    contribution_note: str | None = None,
    is_career_highlight: bool | None = None,
    ctx: Context | None = None,
) -> str:
    """
    Updates an existing task in Tethr. Can also append an engineering contribution note.
    `outcome` and `evidence` are Google Docs table cells: keep them short and put details in
    `description` or `contribution_note`.

    Args:
        task_id: The unique MongoDB ID of the task to update.
        status: New state: todo, in_progress, done, blocked, cancelled.
        outcome: One sentence (max 160 chars): the result of the work.
        evidence: References only (max 120 chars): PR number, commit SHA, branch or link.
        description: Full story (max 2000 chars); replaces the task's current description.
        contribution_note: Optional note to append to the task's engineering log history.
        is_career_highlight: Set to true if this task should be flagged for career appraisal.
    """
    try:
        user_id = get_current_mcp_user_id()
    except ValueError as e:
        return f"Error: {e}"

    if error := length_error(
        "update_task", outcome=outcome, evidence=evidence, description=description
    ):
        return error

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
    if description is not None:
        update_kwargs["description"] = description
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
        return await formatting.with_health_note(
            user_id,
            f"✅ **Task `{task_id}` Updated Successfully!**\n\n{formatting.format_task_summary(task)}",
        )
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
        items_text = "\n\n---\n\n".join([formatting.format_task_summary(t) for t in tasks])
        note = await formatting.sync_health_note(user_id)
        return f"{note}\n\n{header}\n{items_text}" if note else f"{header}\n{items_text}"
    except Exception as exc:
        logger.error(f"MCP get_tasks error: {exc}")
        return f"Error fetching tasks: {str(exc)}"


async def sync_docs(
    summaries: Literal["none", "weekly", "monthly", "both"] = "none",
    ctx: Context | None = None,
) -> str:
    """
    Syncs the user's impact ledger into their connected Google Doc, then reports whether
    this week's summary and this month's dossier are up to date.

    Args:
        summaries: Which AI summaries to (re)write besides the daily table.
            "none" (default): daily table only, unlimited.
            "weekly": this week's summary; uses 1 of the user's 2 weekly summary syncs.
            "monthly": this month's appraisal dossier; uses 1 of 2 monthly syncs.
            "both": both; uses one of each.
            Only write summaries when the user asks for them: out-of-date summaries are
            rewritten automatically every night, and the output says which ones are behind.
    """
    try:
        user_id = get_current_mcp_user_id()
    except ValueError as e:
        return f"Error: {e}"

    cadence_type = SUMMARY_SCOPES.get(summaries)
    if cadence_type is None:
        return '⚠️ **Sync Notice:** `summaries` must be "none", "weekly", "monthly" or "both".'

    try:
        result = await docs.sync.sync_sprint_to_doc(
            user_id=user_id, cadence_type=cadence_type, force=False
        )
        text = (
            f"📄 **Google Docs Sync Successful!**\n\n"
            f"- **Document:** [{result.get('doc_id')}]({result.get('doc_url')})\n"
            f"- **Tasks Synced:** {result.get('synced_tasks_count')} tasks\n"
            f"- **Remaining Manual Summary Syncs:** "
            f"{result.get('remaining_manual_syncs_week')} weekly, "
            f"{result.get('remaining_manual_syncs_month')} monthly"
        )
    except ValueError as ve:
        # User-friendly error such as rate limit reached or missing doc ID
        text = f"⚠️ **Sync Notice:** {str(ve)}"
    except Exception as exc:
        logger.error(f"MCP sync_docs error: {exc}")
        text = f"❌ **Error syncing to Google Docs:** {str(exc)}"

    try:
        status_note = await formatting.summary_status_note(user_id)
    except Exception as exc:
        logger.warning(f"MCP summary status failed for user {user_id}: {exc}")
        status_note = ""
    # After a failed sync, also say whether background syncs are failing
    health_note = "" if text.startswith("📄") else await formatting.sync_health_note(user_id)
    return "\n\n".join(part for part in (text, status_note, health_note) if part)


def register_tools(mcp_instance: FastMCP) -> None:
    """
    Registers all Tethr MCP tools onto a FastMCP server instance.
    """
    mcp_instance.add_tool(add_task)
    mcp_instance.add_tool(update_task)
    mcp_instance.add_tool(get_tasks)
    mcp_instance.add_tool(sync_docs)
