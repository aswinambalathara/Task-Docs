"""
Scheduled ("cron") Google Docs syncs.

Every TICK_INTERVAL_SECONDS the scheduler loop asks run_due_jobs() to find users whose
scheduled syncs are due in their own time zone, and runs them:
- daily_table_cadence "end_of_day": table sync every day at END_OF_DAY_AT
- daily_table_cadence "weekly":     table sync on weekly_day at SUMMARY_AT
- weekly_enabled:                   weekly AI summary on weekly_day at SUMMARY_AT
- monthly_enabled:                  monthly AI dossier on the month's last day at SUMMARY_AT
- always:                           nightly at END_OF_DAY_AT, rewrite cached summaries whose
                                    period gained or lost tasks since they were written
- table_sync_pending:               retry a failed realtime table sync (with the back-off below)

Each job records the local period it completed (day / ISO week / month), so restarts and
multiple workers never run a period twice, and a tick after downtime catches up on the
current period. Scheduled syncs pass force=True: they never use the user's manual quota.

run_due_jobs() holds all the logic and takes `now`, so it can be tested directly or
triggered by an external cron later; auto_sync_loop() is only the in-process trigger.
"""

import asyncio
import calendar
import contextlib
import os
import socket
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from pymongo.errors import DuplicateKeyError

from app.core.logger import logger
from app.core.timezones import get_zone
from app.models.integration import Integration, SyncCadence
from app.models.task import Task
from app.services.google_docs import GoogleDocsService

TICK_INTERVAL_SECONDS = 600
# Slightly shorter than the tick, so the lease is free again by the next tick
LEASE_SECONDS = TICK_INTERVAL_SECONDS - 30
LEASE_ID = "auto_sync"

END_OF_DAY_AT = time(23, 0)
SUMMARY_AT = time(18, 0)

MAX_CONCURRENT_SYNCS = 3
FIRST_RETRY_DELAY = timedelta(minutes=10)
MAX_RETRY_DELAY = timedelta(hours=24)

_INSTANCE_ID = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"


@dataclass
class DueJobs:
    """Period keys of the scheduled jobs due for one user (None = not due)."""

    weekly: str | None = None  # "2026-W41"
    monthly: str | None = None  # "2026-10"
    table: str | None = None  # "2026-10-12" or "2026-W41"
    refresh: str | None = None  # "2026-10-12": nightly stale-summary refresh
    retry_table: bool = False  # a realtime table sync failed and must be retried

    @property
    def cadence_type(self) -> str | None:
        # A summary sync rebuilds the whole document, so it also covers a due table sync
        if self.weekly and self.monthly:
            return "all"
        if self.weekly:
            return "weekly_summary"
        if self.monthly:
            return "monthly_dossier"
        if self.table or self.retry_table:
            return "daily_table"
        return None


def week_key(day: date) -> str:
    iso = day.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def find_due_jobs(cadence: SyncCadence, local_now: datetime) -> DueJobs:
    """Pure scheduling rules: which jobs are due at `local_now` (in the user's time zone)."""
    today = local_now.date()
    wall_clock = local_now.replace(tzinfo=None)
    due = DueJobs()

    # Weekly slot: the user's weekly_day of the current Mon-Sun week, at SUMMARY_AT
    week_start = today - timedelta(days=today.weekday())
    weekly_day = GoogleDocsService.WEEKDAY_MAP.get(cadence.weekly_day, 5)
    weekly_slot = datetime.combine(week_start + timedelta(days=weekly_day), SUMMARY_AT)
    weekly_slot_reached = wall_clock >= weekly_slot
    this_week = week_key(today)

    if cadence.weekly_enabled and weekly_slot_reached and cadence.last_weekly_period != this_week:
        due.weekly = this_week

    this_month = f"{today.year}-{today.month:02d}"
    is_last_day = today.day == calendar.monthrange(today.year, today.month)[1]
    if (
        cadence.monthly_enabled
        and is_last_day
        and wall_clock.time() >= SUMMARY_AT
        and cadence.last_monthly_period != this_month
    ):
        due.monthly = this_month

    if cadence.daily_table_cadence == "end_of_day":
        this_day = today.isoformat()
        if wall_clock.time() >= END_OF_DAY_AT and cadence.last_table_period != this_day:
            due.table = this_day
    elif cadence.daily_table_cadence == "weekly":
        if weekly_slot_reached and cadence.last_table_period != this_week:
            due.table = this_week

    this_day = today.isoformat()
    if wall_clock.time() >= END_OF_DAY_AT and cadence.last_refresh_period != this_day:
        due.refresh = this_day

    if cadence.table_sync_pending:
        due.retry_table = True

    return due


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


async def _set_cadence_fields(integration: Integration, fields: dict[str, Any]) -> None:
    # Targeted $set: the sync itself saved the document (cached summaries, timestamps),
    # so saving this stale copy would overwrite those changes
    await Integration.get_motor_collection().update_one(
        {"_id": integration.id}, {"$set": {f"cadence.{k}": v for k, v in fields.items()}}
    )


async def _refresh_stale_summaries(user_id: str) -> None:
    # Best effort, at most once a night: a failure waits for the next night instead of the
    # retry back-off, so a broken render cannot regenerate summaries with Gemini every tick
    try:
        await GoogleDocsService.refresh_stale_summaries(user_id)
    except Exception as exc:
        logger.warning(f"Stale summary refresh failed for user {user_id}: {exc}")
        await GoogleDocsService.record_sync_failure(user_id, exc)


async def process_integration(integration: Integration, now: datetime) -> str:
    """Runs one user's due jobs. Returns "idle", "waiting", "synced" or "failed"."""
    cadence = integration.cadence
    if cadence.auto_sync_retry_at and _as_utc(cadence.auto_sync_retry_at) > now:
        return "waiting"

    due = find_due_jobs(cadence, now.astimezone(get_zone(cadence.timezone)))
    cadence_type = due.cadence_type
    if cadence_type is None and due.refresh is None:
        return "idle"

    try:
        if cadence_type is not None:
            has_tasks = await Task.find({"user_id": integration.user_id}).count() > 0
            # Nothing to summarize yet: the period simply counts as done
            if has_tasks or cadence_type == "daily_table":
                await GoogleDocsService.sync_sprint_to_doc(
                    user_id=integration.user_id, cadence_type=cadence_type, force=True
                )
    except Exception as exc:
        failures = cadence.auto_sync_failures + 1
        delay = min(FIRST_RETRY_DELAY * 2 ** min(failures - 1, 10), MAX_RETRY_DELAY)
        await _set_cadence_fields(
            integration, {"auto_sync_failures": failures, "auto_sync_retry_at": now + delay}
        )
        await GoogleDocsService.record_sync_failure(integration.user_id, exc)
        logger.warning(
            f"Scheduled {cadence_type} sync failed for user {integration.user_id} "
            f"(attempt {failures}, retrying in {delay}): {exc}"
        )
        return "failed"

    done: dict[str, Any] = {"auto_sync_failures": 0, "auto_sync_retry_at": None}
    if due.weekly:
        done["last_weekly_period"] = due.weekly
    if due.monthly:
        done["last_monthly_period"] = due.monthly
    if due.table:
        done["last_table_period"] = due.table
    if due.refresh:
        # After the scheduled sync, so a summary it just rewrote is not refreshed twice
        await _refresh_stale_summaries(integration.user_id)
        done["last_refresh_period"] = due.refresh
    await _set_cadence_fields(integration, done)
    logger.info(
        f"Scheduled {cadence_type or 'summary refresh'} job completed for user {integration.user_id}"
    )
    return "synced"


async def run_due_jobs(now: datetime | None = None) -> dict[str, int]:
    """One scheduler tick over every user with a target Google Doc."""
    now = now or datetime.now(UTC)
    integrations = await Integration.find(
        {"provider": "google_docs", "target_doc_id": {"$nin": ["", None]}}
    ).to_list()

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_SYNCS)

    async def run_one(integration: Integration) -> str:
        async with semaphore:
            try:
                return await process_integration(integration, now)
            except Exception as exc:
                logger.error(f"Auto-sync crashed for user {integration.user_id}: {exc}")
                return "failed"

    results = Counter(await asyncio.gather(*(run_one(i) for i in integrations)))
    if results["synced"] or results["failed"]:
        logger.info(f"Auto-sync tick: {dict(results)}")
    return dict(results)


async def acquire_lease(now: datetime) -> bool:
    """
    Claims this tick for the current process. With several workers only the lease
    holder runs the tick; the others skip it.
    """
    leases = Integration.get_motor_collection().database["scheduler_leases"]
    try:
        await leases.find_one_and_update(
            {
                "_id": LEASE_ID,
                "$or": [{"expires_at": {"$lte": now}}, {"owner": _INSTANCE_ID}],
            },
            {
                "$set": {
                    "owner": _INSTANCE_ID,
                    "expires_at": now + timedelta(seconds=LEASE_SECONDS),
                }
            },
            upsert=True,
        )
        return True
    except DuplicateKeyError:
        # The lease document exists and another live process holds it
        return False


async def auto_sync_loop(stop: asyncio.Event) -> None:
    logger.info(f"Auto-sync scheduler started (tick every {TICK_INTERVAL_SECONDS}s)")
    while not stop.is_set():
        try:
            now = datetime.now(UTC)
            if await acquire_lease(now):
                await run_due_jobs(now)
        except Exception as exc:
            logger.error(f"Auto-sync tick failed: {exc}")
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(stop.wait(), timeout=TICK_INTERVAL_SECONDS)


class AutoSyncScheduler:
    """Starts and stops the in-process scheduler loop with the application lifespan."""

    def __init__(self) -> None:
        self._stop = asyncio.Event()
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(auto_sync_loop(self._stop))

    async def stop(self) -> None:
        if not self._task:
            return
        self._stop.set()
        # Let an in-flight tick finish briefly, then cancel it
        with contextlib.suppress(TimeoutError, asyncio.CancelledError):
            await asyncio.wait_for(self._task, timeout=10)
        logger.info("Auto-sync scheduler stopped")
