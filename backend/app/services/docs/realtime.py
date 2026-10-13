"""
Background Daily Table syncs after task changes, coalesced per user.
"""

import asyncio

from loguru import logger

from app.models.integration import Integration
from app.services.docs import sync

# Realtime sync coalescing: users with a sync running / a change waiting for another run
_realtime_running: set[str] = set()


_realtime_pending: set[str] = set()


_background_tasks: set[asyncio.Task] = set()


def schedule_realtime_sync(user_id: str) -> None:
    """
    Fire-and-forget realtime Daily Table sync after a task is completed or changed.
    Runs in the background so API/MCP responses never wait on Google, and rapid
    successive changes are coalesced into at most one follow-up sync per user.
    """
    if user_id in _realtime_running:
        _realtime_pending.add(user_id)
        return

    _realtime_running.add(user_id)
    bg_task = asyncio.create_task(_run_realtime_sync(user_id))
    # Keep a strong reference so the task is not garbage-collected mid-run
    _background_tasks.add(bg_task)
    bg_task.add_done_callback(_background_tasks.discard)


async def _run_realtime_sync(user_id: str) -> None:
    try:
        while True:
            _realtime_pending.discard(user_id)
            await sync_task_realtime(user_id)
            if user_id not in _realtime_pending:
                break
    finally:
        _realtime_running.discard(user_id)


async def sync_task_realtime(user_id: str) -> bool:
    """
    Immediately syncs the Google Doc Daily Contribution Log table
    if the user's cadence is configured for realtime sync.
    """
    try:
        integration = await Integration.find_one(
            {"user_id": user_id, "provider": "google_docs"}
        )
        if not integration or not integration.target_doc_id:
            return False
        if integration.cadence.daily_table_cadence != "realtime":
            return False

        res = await sync.sync_sprint_to_doc(
            user_id=user_id,
            cadence_type="daily_table",
            force=True,
        )
        return res.get("success", False)
    except Exception as exc:
        logger.warning(f"Realtime sync to Google Docs failed for user {user_id}: {exc}")
        # Nobody is waiting on this sync, so leave a retry for the scheduler and an
        # error the dashboard and MCP tools can show
        await sync.record_sync_failure(user_id, exc, table_pending=True)
        return False
