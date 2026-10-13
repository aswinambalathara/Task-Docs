"""
Cached AI summaries: which tasks they cover, whether they are current, and the nightly refresh.
"""

import asyncio
from datetime import UTC, datetime
from typing import Any, Literal

from loguru import logger

from app.core.timezones import get_zone, to_local
from app.models.integration import Integration, SummaryMeta
from app.models.task import Task
from app.services.docs import oauth, periods, renderer


def store_summary(
    integration: Integration,
    key: str,
    text: str,
    source_tasks: list[Task],
    client_fingerprint: str | None = None,
) -> None:
    """Caches a summary with the fingerprint of the tasks it was written about."""
    computed = periods.fingerprint(source_tasks)
    integration.cached_summaries[key] = text
    integration.summary_meta[key] = SummaryMeta(
        fingerprint=client_fingerprint or computed,
        # A previewed text may cover a different task set than the one at sync time
        task_count=len(source_tasks) if client_fingerprint in (None, computed) else None,
    )


async def get_period_tasks(user_id: str, mode: Literal["weekly", "monthly"]) -> list[Task]:
    """The tasks a weekly summary or monthly dossier synced now would be written about."""
    integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
    zone = get_zone(integration.cadence.timezone if integration else None)
    tasks = await Task.find({"user_id": user_id}).sort("+date").to_list()
    tasks = [t.model_copy(update={"date": to_local(t.date, zone)}) for t in tasks]
    period = periods.target_period(tasks, datetime.now(UTC).astimezone(zone))
    if mode == "monthly":
        return periods.month_tasks(tasks, period)
    return periods.week_tasks(tasks, period)


async def get_summary_status(user_id: str) -> dict[str, Any] | None:
    """Whether the target week's summary and month's dossier exist and are still current."""
    integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
    if not integration:
        return None
    zone = get_zone(integration.cadence.timezone)
    tasks = await Task.find({"user_id": user_id}).to_list()
    tasks = [t.model_copy(update={"date": to_local(t.date, zone)}) for t in tasks]
    period = periods.target_period(tasks, datetime.now(UTC).astimezone(zone))

    def state(key: str) -> dict[str, Any]:
        return periods.summary_state(
            integration.summary_meta, key in integration.cached_summaries, tasks, key
        )

    return {
        "week_num": period.week_num,
        "week_start": period.week_start,
        "week_end": period.week_end,
        "weekly": state(period.weekly_key),
        "monthly": state(period.monthly_key),
    }


async def refresh_stale_summaries(user_id: str, max_refresh: int = 4) -> int:
    """
    Rewrites cached summaries whose period gained or lost tasks since they were written,
    then re-renders the document once. Run by the nightly scheduler job, so it never uses
    the user's manual quota. Returns how many summaries were refreshed.
    """
    lock = renderer.render_locks.setdefault(user_id, asyncio.Lock())
    async with lock:
        integration = await Integration.find_one(
            {"user_id": user_id, "provider": "google_docs"}
        )
        # Cheap exit for the common case: nothing was ever summarized with a fingerprint
        if not integration or not integration.target_doc_id or not integration.summary_meta:
            return 0

        zone = get_zone(integration.cadence.timezone)
        tasks = await Task.find({"user_id": user_id}).sort("+date").to_list()
        tasks = [t.model_copy(update={"date": to_local(t.date, zone)}) for t in tasks]
        stale = periods.stale_summary_keys(
            integration.cached_summaries, integration.summary_meta, tasks
        )[:max_refresh]
        if not stale:
            return 0

        credentials = await oauth.get_credentials(user_id)
        if not credentials:
            raise ValueError(
                "Google authentication credentials are invalid or expired. "
                "Please re-authenticate."
            )

        from app.services.ai.summarizer import AIService

        for key in stale:
            period_tasks = periods.tasks_for_key(tasks, key) or []
            if not period_tasks:
                # Every task of that period was deleted: drop the summary entirely
                integration.cached_summaries.pop(key, None)
                integration.summary_meta.pop(key, None)
                continue
            mode = "monthly" if key.startswith("monthly:") else "weekly"
            text, _ = await AIService.generate_summary(tasks=period_tasks, mode=mode)
            store_summary(integration, key, text, period_tasks)

        now = datetime.now(UTC)
        await renderer.render_document(
            integration,
            credentials,
            tasks,
            periods.target_period(tasks, now.astimezone(zone)),
            today=now.astimezone(zone).date(),
            cadence_type="daily_table",
        )
        integration.updated_at = now
        await integration.save()
        logger.info(f"Refreshed {len(stale)} stale summary(ies) for user {user_id}: {stale}")
        return len(stale)
