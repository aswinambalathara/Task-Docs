from datetime import UTC, date, datetime, timedelta
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import pytest

from app.core.security import encrypt_token
from app.models.integration import GoogleTokens, Integration, SyncCadence
from app.models.task import Task
from app.services import docs, scheduler
from app.services.scheduler import acquire_lease, find_due_jobs, run_due_jobs

IST = ZoneInfo("Asia/Kolkata")


def ist(*args) -> datetime:
    return datetime(*args, tzinfo=IST)


# --- Pure scheduling rules (2026-10-10 is a Saturday; 2026-10-31 is a Saturday and month end) ---


def test_weekly_summary_due_from_weekly_day_at_18():
    cadence = SyncCadence(weekly_day="Saturday", monthly_enabled=False)
    assert find_due_jobs(cadence, ist(2026, 10, 10, 17, 59)).cadence_type is None

    due = find_due_jobs(cadence, ist(2026, 10, 10, 18, 0))
    assert due.weekly == "2026-W41"
    assert due.cadence_type == "weekly_summary"

    # Catch-up later in the same week (e.g. server was down on Saturday evening)
    assert find_due_jobs(cadence, ist(2026, 10, 11, 9, 0)).weekly == "2026-W41"

    # Already done for this week -> not due again
    cadence.last_weekly_period = "2026-W41"
    assert find_due_jobs(cadence, ist(2026, 10, 11, 9, 0)).cadence_type is None


def test_weekly_disabled_and_custom_weekday():
    assert find_due_jobs(
        SyncCadence(weekly_enabled=False, monthly_enabled=False), ist(2026, 10, 11, 20, 0)
    ).cadence_type is None

    friday = SyncCadence(weekly_day="Friday", monthly_enabled=False)
    assert find_due_jobs(friday, ist(2026, 10, 9, 18, 30)).weekly == "2026-W41"


def test_monthly_dossier_due_on_last_day_at_18():
    cadence = SyncCadence(weekly_enabled=False)
    assert find_due_jobs(cadence, ist(2026, 9, 29, 20, 0)).cadence_type is None
    assert find_due_jobs(cadence, ist(2026, 9, 30, 17, 0)).cadence_type is None
    assert find_due_jobs(cadence, ist(2026, 9, 30, 18, 0)).monthly == "2026-09"


def test_weekly_and_monthly_together_run_as_one_full_sync():
    due = find_due_jobs(SyncCadence(), ist(2026, 10, 31, 18, 0))
    assert (due.weekly, due.monthly) == ("2026-W44", "2026-10")
    assert due.cadence_type == "all"


def test_table_cadences():
    eod = SyncCadence(daily_table_cadence="end_of_day", weekly_enabled=False, monthly_enabled=False)
    assert find_due_jobs(eod, ist(2026, 10, 12, 22, 59)).cadence_type is None
    due = find_due_jobs(eod, ist(2026, 10, 12, 23, 0))
    assert (due.table, due.cadence_type) == ("2026-10-12", "daily_table")

    weekly = SyncCadence(daily_table_cadence="weekly", weekly_enabled=False, monthly_enabled=False)
    assert find_due_jobs(weekly, ist(2026, 10, 10, 18, 0)).table == "2026-W41"

    # Realtime tables are handled on task changes, never by the scheduler
    realtime = SyncCadence(weekly_enabled=False, monthly_enabled=False)
    assert find_due_jobs(realtime, ist(2026, 10, 12, 23, 30)).cadence_type is None


# --- Scheduler tick against the database ---


async def _make_integration(user_id: str, **cadence) -> Integration:
    integration = Integration(
        user_id=user_id,
        target_doc_id=f"doc_{user_id}",
        google_tokens=GoogleTokens(access_token="x", refresh_token=encrypt_token("r"), expiry_date=0),
        cadence=SyncCadence(**cadence),
    )
    await integration.insert()
    await Task(user_id=user_id, title="Shipped something").insert()
    return integration


def _calls_for(mock: AsyncMock, user_id: str) -> list[dict]:
    return [c.kwargs for c in mock.call_args_list if c.kwargs["user_id"] == user_id]


@pytest.mark.asyncio
async def test_tick_runs_due_jobs_once_in_user_time_zone():
    user_id = "user_tick_ist"
    integration = await _make_integration(user_id, timezone="Asia/Kolkata", monthly_enabled=False)
    utc_user = await _make_integration("user_tick_utc", monthly_enabled=False)

    async def fake_sync(user_id, cadence_type, force):
        # The real sync saves the document (e.g. cached summaries); the tick must not undo it
        doc = await Integration.find_one({"user_id": user_id})
        doc.cached_summaries["weekly:2026:10:2"] = "AI summary"
        await doc.save()
        return {"success": True}

    sync = AsyncMock(side_effect=fake_sync)
    # Saturday 12:35 UTC = 18:05 IST: due for the IST user, still before 18:00 for the UTC user
    now = datetime(2026, 10, 10, 12, 35, tzinfo=UTC)
    with patch.object(docs.sync, "sync_sprint_to_doc", sync):
        await run_due_jobs(now)
        await run_due_jobs(now + timedelta(minutes=10))

    assert _calls_for(sync, user_id) == [
        {"user_id": user_id, "cadence_type": "weekly_summary", "force": True}
    ]
    assert _calls_for(sync, utc_user.user_id) == []

    stored = await Integration.get(integration.id)
    assert stored.cadence.last_weekly_period == "2026-W41"
    assert stored.cached_summaries["weekly:2026:10:2"] == "AI summary"


@pytest.mark.asyncio
async def test_failed_sync_backs_off_then_retries():
    user_id = "user_tick_failing"
    integration = await _make_integration(user_id, timezone="Asia/Kolkata", monthly_enabled=False)
    now = datetime(2026, 10, 10, 12, 35, tzinfo=UTC)

    failing = AsyncMock(side_effect=ValueError("Google credentials revoked"))
    with patch.object(docs.sync, "sync_sprint_to_doc", failing):
        await run_due_jobs(now)
    stored = await Integration.get(integration.id)
    assert stored.cadence.auto_sync_failures == 1
    assert stored.cadence.last_weekly_period is None

    working = AsyncMock(return_value={"success": True})
    with patch.object(docs.sync, "sync_sprint_to_doc", working):
        await run_due_jobs(now + timedelta(minutes=5))  # still inside the back-off window
        assert _calls_for(working, user_id) == []
        await run_due_jobs(now + timedelta(minutes=11))
        assert len(_calls_for(working, user_id)) == 1

    stored = await Integration.get(integration.id)
    assert stored.cadence.auto_sync_failures == 0
    assert stored.cadence.last_weekly_period == "2026-W41"


@pytest.mark.asyncio
async def test_only_one_process_holds_the_lease(monkeypatch):
    now = datetime(2026, 10, 10, 12, 0, tzinfo=UTC)
    monkeypatch.setattr(scheduler, "LEASE_ID", "lease_test")

    monkeypatch.setattr(scheduler, "_INSTANCE_ID", "worker-a")
    assert await acquire_lease(now) is True

    monkeypatch.setattr(scheduler, "_INSTANCE_ID", "worker-b")
    assert await acquire_lease(now + timedelta(minutes=1)) is False
    expired = now + timedelta(seconds=scheduler.LEASE_SECONDS + 1)
    assert await acquire_lease(expired) is True


# --- Time zone storage and use in the document ---


@pytest.mark.asyncio
async def test_cadence_timezone_update_and_validation(client):
    headers = {"Authorization": "Bearer mock_user_tz"}
    await _make_integration("mock_user_tz")

    ok = await client.patch(
        "/api/v1/integrations/google/cadence", headers=headers, json={"timezone": "Asia/Kolkata"}
    )
    assert ok.status_code == 200
    assert ok.json()["cadence"]["timezone"] == "Asia/Kolkata"

    bad = await client.patch(
        "/api/v1/integrations/google/cadence", headers=headers, json={"timezone": "Mars/Base"}
    )
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_sync_places_tasks_on_their_local_day():
    user_id = "user_local_day"
    await Integration(
        user_id=user_id,
        target_doc_id="doc_local_day",
        google_tokens=GoogleTokens(access_token="x", refresh_token=encrypt_token("r"), expiry_date=0),
        cadence=SyncCadence(timezone="Asia/Kolkata"),
    ).insert()
    # Monday 00:30 IST is still Sunday in UTC
    await Task(user_id=user_id, title="Late night fix", date=datetime(2026, 10, 11, 19, 0, tzinfo=UTC)).insert()

    render = patch.object(docs.renderer, "render_structured_ledger_document")
    with (
        patch.object(docs.oauth, "get_credentials", AsyncMock(return_value=object())),
        patch("app.services.docs.renderer.build", return_value=object()),
        render as rendered,
    ):
        await docs.sync.sync_sprint_to_doc(user_id=user_id, cadence_type="daily_table")

    tasks = rendered.call_args.kwargs["tasks"]
    assert tasks[0].date.date() == date(2026, 10, 12)
    # Only an in-memory copy was localized; the stored value is unchanged
    stored = await Task.find_one({"user_id": user_id})
    assert stored.date.replace(tzinfo=UTC) == datetime(2026, 10, 11, 19, 0, tzinfo=UTC)
