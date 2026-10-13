"""
Markdown text for MCP tool results: task cards, sync-health warnings and summary status.
"""

import calendar
from datetime import UTC, datetime

from app.models.integration import Integration
from app.models.task import Task
from app.services import docs


def ago(dt: datetime | None) -> str:
    if dt is None:
        return "recently"
    aware = dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    minutes = int((datetime.now(UTC) - aware).total_seconds() // 60)
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{minutes} min ago"
    if minutes < 48 * 60:
        return f"{minutes // 60} h ago"
    return f"{minutes // (24 * 60)} days ago"


async def sync_health_note(user_id: str) -> str:
    """A warning when an unattended (background or scheduled) sync failed, else ""."""
    integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
    if not integration or not integration.cadence.last_sync_error:
        return ""
    cadence = integration.cadence
    action = (
        "It retries automatically; call `sync_docs` to retry now."
        if cadence.last_sync_error_retryable
        else "Reconnect Google Docs (or select the target doc) in Tethr Settings, "
        "then call `sync_docs`."
    )
    return (
        f"⚠️ **Google Docs is out of date:** the last background sync failed "
        f"{ago(cadence.last_sync_error_at)} ({cadence.last_sync_error}). "
        f"Your tasks are saved. {action}"
    )


async def with_health_note(user_id: str, text: str) -> str:
    note = await sync_health_note(user_id)
    return f"{text}\n\n{note}" if note else text


async def summary_status_note(user_id: str) -> str:
    """Whether this week's summary and this month's dossier exist and are current."""
    status = await docs.summaries.get_summary_status(user_id)
    integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
    if status is None or integration is None:
        return ""
    cadence = integration.cadence

    def line(kind: str) -> str:
        state = status[kind]
        if kind == "weekly":
            label = (
                f"Week {status['week_num']} summary "
                f"({status['week_start']:%d %b}–{status['week_end']:%d %b})"
            )
            auto = (
                f"written automatically on {cadence.weekly_day} at 18:00"
                if cadence.weekly_enabled
                else None
            )
        else:
            month = int(state["key"].split(":")[2])
            label = f"{calendar.month_name[month]} dossier"
            auto = (
                "written automatically on the last day of the month at 18:00"
                if cadence.monthly_enabled
                else None
            )
        call = f'`sync_docs(summaries="{kind}")`'

        if not state["generated"]:
            if state["current_task_count"] == 0:
                return f"- {label}: no tasks logged yet"
            when = f"{auto}, or call {call}" if auto else f"call {call} to write it"
            return f"- {label}: not written yet ({state['current_task_count']} task(s)); {when}"
        if state["stale"]:
            if state["summarized_task_count"] is not None:
                detail = (
                    f"written about {state['summarized_task_count']} task(s), "
                    f"{state['current_task_count']} logged now"
                )
            else:
                detail = f"tasks changed since it was written ({state['current_task_count']} now)"
            return (
                f"- {label}: ⚠️ out of date, {detail}. Rewritten automatically tonight, "
                f"or call {call} to replace it now."
            )
        return f"- {label}: ✅ up to date ({state['current_task_count']} task(s))"

    return "**Summaries:**\n" + "\n".join([line("weekly"), line("monthly")])


def format_task_summary(task: Task) -> str:
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
