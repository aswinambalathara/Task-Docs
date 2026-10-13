"""
Syncing the ledger to Google Docs: manual sync limits, the full sync, and failure recording.
"""

import asyncio
from datetime import UTC, datetime
from typing import Any, Literal

from googleapiclient.errors import HttpError

from app.core.timezones import get_zone, to_local
from app.models.integration import Integration
from app.models.task import Task
from app.services.docs import oauth, periods, renderer, summaries
from app.services.tasks import TaskService


def check_and_update_rate_limit(
    integration: Integration,
    cadence_type: Literal["daily_table", "weekly_summary", "monthly_dossier", "all"] = "all",
    force: bool = False,
) -> tuple[int, int]:
    """
    Enforces maximum 2 manual syncs per weekly and monthly cycle for summary generation.
    Daily table syncs are not rate-limited.
    Automatically resets counters if the calendar week or month has rolled over.
    """
    now = datetime.now(UTC)
    cadence = integration.cadence

    week_start = cadence.week_cycle_started_at
    if week_start.tzinfo is None:
        week_start = week_start.replace(tzinfo=UTC)

    month_start = cadence.month_cycle_started_at
    if month_start.tzinfo is None:
        month_start = month_start.replace(tzinfo=UTC)

    # Check weekly cycle rollover (7 days)
    if (now - week_start).days >= 7:
        cadence.manual_syncs_this_week = 0
        cadence.week_cycle_started_at = now

    # Check monthly cycle rollover (calendar month)
    if (
        now.month != month_start.month
        or now.year != month_start.year
    ):
        cadence.manual_syncs_this_month = 0
        cadence.month_cycle_started_at = now

    if not force:
        if cadence_type in ["weekly_summary", "all"]:
            if cadence.manual_syncs_this_week >= cadence.max_manual_syncs_per_cycle:
                raise ValueError(
                    f"Weekly manual sync limit reached ({cadence.max_manual_syncs_per_cycle} max). "
                    f"Next automated sync is scheduled for {cadence.weekly_day}."
                )
            cadence.manual_syncs_this_week += 1

        if cadence_type in ["monthly_dossier", "all"]:
            if cadence.manual_syncs_this_month >= cadence.max_manual_syncs_per_cycle:
                raise ValueError(
                    f"Monthly manual sync limit reached ({cadence.max_manual_syncs_per_cycle} max). "
                    "Next automated sync is scheduled for the last calendar day of this month."
                )
            cadence.manual_syncs_this_month += 1

    remaining_week = max(0, cadence.max_manual_syncs_per_cycle - cadence.manual_syncs_this_week)
    remaining_month = max(
        0, cadence.max_manual_syncs_per_cycle - cadence.manual_syncs_this_month
    )
    return remaining_week, remaining_month


def is_retryable_error(exc: Exception) -> bool:
    """False when retrying cannot help until the user acts (reconnect, fix the doc)."""
    if isinstance(exc, ValueError):
        # Raised for expired Google credentials and a missing target doc
        return False
    if isinstance(exc, HttpError):
        # Doc deleted, access revoked, or a malformed request; 429 and 5xx are temporary
        return exc.resp.status not in (400, 401, 403, 404)
    return True


async def record_sync_failure(
    user_id: str, exc: Exception, table_pending: bool = False
) -> None:
    fields: dict[str, Any] = {
        "cadence.last_sync_error": str(exc) or exc.__class__.__name__,
        "cadence.last_sync_error_at": datetime.now(UTC),
        "cadence.last_sync_error_retryable": is_retryable_error(exc),
    }
    if table_pending:
        fields["cadence.table_sync_pending"] = True
    # Targeted $set: never overwrite the rest of a document another sync may be saving
    await Integration.get_motor_collection().update_one(
        {"user_id": user_id, "provider": "google_docs"}, {"$set": fields}
    )


async def sync_sprint_to_doc(
    user_id: str,
    task_ids: list[str] | None = None,
    cadence_type: Literal["daily_table", "weekly_summary", "monthly_dossier", "all"] = "all",
    executive_summary: str | None = None,
    include_contributions: bool = True,
    force: bool = False,
    monthly_dossier: str | None = None,
    weekly_fingerprint: str | None = None,
    monthly_fingerprint: str | None = None,
) -> dict[str, Any]:
    """
    Executes Google Docs batchUpdate to sync structured impact tables and summaries
    while respecting the cadence rate limits.

    The document is rebuilt from the user's entire ledger on every sync, so `task_ids`
    only selects which tasks the AI summaries are written about. Without `task_ids`,
    the weekly summary covers the target week and the monthly dossier the target month.

    `executive_summary` / `monthly_dossier` are previewed texts to use instead of
    generating new ones; their `*_fingerprint` (from the preview response) records which
    tasks they were written about, so a later change to that period marks them stale.
    """
    lock = renderer.render_locks.setdefault(user_id, asyncio.Lock())
    async with lock:
        return await _sync_sprint_to_doc_locked(
            user_id=user_id,
            task_ids=task_ids,
            cadence_type=cadence_type,
            executive_summary=executive_summary,
            monthly_dossier=monthly_dossier,
            weekly_fingerprint=weekly_fingerprint,
            monthly_fingerprint=monthly_fingerprint,
            force=force,
        )


async def _sync_sprint_to_doc_locked(
    user_id: str,
    task_ids: list[str] | None,
    cadence_type: Literal["daily_table", "weekly_summary", "monthly_dossier", "all"],
    executive_summary: str | None,
    monthly_dossier: str | None,
    weekly_fingerprint: str | None,
    monthly_fingerprint: str | None,
    force: bool,
) -> dict[str, Any]:
    integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
    if not integration or not integration.target_doc_id:
        raise ValueError(
            "No target Google Doc configured. Please connect and select a doc in Settings."
        )

    credentials = await oauth.get_credentials(user_id)
    if not credentials:
        raise ValueError(
            "Google authentication credentials are invalid or expired. Please re-authenticate."
        )

    # 1. Enforce rate limiting
    rem_week, rem_month = check_and_update_rate_limit(
        integration, cadence_type=cadence_type, force=force
    )

    # 2. Fetch tasks for user (complete ledger)
    fetched_at = datetime.now(UTC)
    tasks = await Task.find({"user_id": user_id}).sort("+date").to_list()
    if not tasks and cadence_type != "daily_table":
        raise ValueError("No tasks found to sync.")

    # Work in the user's time zone: a task logged at 00:30 IST belongs to that IST day,
    # not to the previous UTC day. In-memory copies only; nothing is written back.
    zone = get_zone(integration.cadence.timezone)
    tasks = [t.model_copy(update={"date": to_local(t.date, zone)}) for t in tasks]

    # 3. The week and month that summaries are written for
    now = datetime.now(UTC)
    period = periods.target_period(tasks, now.astimezone(zone))

    # 4. Generate summaries if needed, from the tasks they are about
    from app.services.ai.summarizer import AIService

    if task_ids:
        wanted = set(task_ids)
        week_source = month_source = [t for t in tasks if str(t.id) in wanted]
    else:
        week_source = periods.week_tasks(tasks, period)
        month_source = periods.month_tasks(tasks, period)

    wants_weekly = cadence_type in ["weekly_summary", "all"]
    wants_monthly = cadence_type in ["monthly_dossier", "all"]
    # A previewed text is only used for the summary kind it was written as
    weekly_summary = executive_summary if wants_weekly else None
    monthly_text = monthly_dossier if wants_monthly else None
    weekly_fp = weekly_fingerprint if weekly_summary else None
    monthly_fp = monthly_fingerprint if monthly_text else None

    if wants_weekly and not weekly_summary and week_source:
        weekly_summary, _ = await AIService.generate_summary(tasks=week_source, mode="weekly")

    if wants_monthly and not monthly_text and month_source:
        monthly_text, _ = await AIService.generate_summary(tasks=month_source, mode="monthly")

    if weekly_summary:
        summaries.store_summary(
            integration, period.weekly_key, weekly_summary, week_source, weekly_fp
        )
    if monthly_text:
        summaries.store_summary(
            integration, period.monthly_key, monthly_text, month_source, monthly_fp
        )

    # 5. Render the structured ledger document idempotently with scheduling rules
    await renderer.render_document(
        integration,
        credentials,
        tasks,
        period,
        today=now.astimezone(zone).date(),
        cadence_type=cadence_type,
        weekly_summary=weekly_summary,
        monthly_dossier=monthly_text,
    )

    # 6. Mark tasks as synced and record sync timestamp
    if cadence_type in ["weekly_summary", "all"]:
        integration.cadence.last_weekly_sync_at = now
    if cadence_type in ["monthly_dossier", "all"]:
        integration.cadence.last_monthly_sync_at = now
    # Every sync rebuilds the whole document, so any earlier failure is now repaired
    integration.cadence.table_sync_pending = False
    integration.cadence.last_sync_error = None
    integration.cadence.last_sync_error_at = None
    integration.cadence.last_sync_error_retryable = True
    integration.updated_at = now
    await integration.save()

    # Tasks edited while the render was running were not rendered with their new content
    synced_ids = [str(t.id) for t in tasks]
    await TaskService.mark_tasks_as_synced(
        task_ids=synced_ids, user_id=user_id, unchanged_since=fetched_at
    )

    doc_url = f"https://docs.google.com/document/d/{integration.target_doc_id}/edit"
    return {
        "success": True,
        "doc_id": integration.target_doc_id,
        "synced_tasks_count": len(tasks),
        "doc_url": doc_url,
        "synced_at": now,
        "cadence_type": cadence_type,
        "remaining_manual_syncs_week": rem_week,
        "remaining_manual_syncs_month": rem_month,
    }
