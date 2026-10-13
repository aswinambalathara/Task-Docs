from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from googleapiclient.errors import HttpError
from httplib2 import Response

from app.core.security import encrypt_token
from app.mcp.server import current_mcp_user_var, get_tasks, sync_docs
from app.models.integration import GoogleTokens, Integration, SyncCadence
from app.models.task import Task
from app.services import docs
from app.services.ai.summarizer import AIService
from app.services.scheduler import find_due_jobs, run_due_jobs

IST = ZoneInfo("Asia/Kolkata")


async def _make_integration(user_id: str, **cadence) -> Integration:
    integration = Integration(
        user_id=user_id,
        target_doc_id=f"doc_{user_id}",
        google_tokens=GoogleTokens(
            access_token="x", refresh_token=encrypt_token("r"), expiry_date=0
        ),
        cadence=SyncCadence(**cadence),
    )
    await integration.insert()
    return integration


@contextmanager
def _fake_google(render_error: Exception | None = None):
    async def fake_summary(tasks, mode="weekly", **_):
        return f"{mode} summary", "gemini-2.0-flash"

    render = MagicMock(side_effect=render_error)
    with (
        patch.object(docs.oauth, "get_credentials", AsyncMock(return_value=object())),
        patch("app.services.docs.renderer.build", return_value=object()),
        patch.object(docs.renderer, "render_structured_ledger_document", render),
        patch.object(AIService, "generate_summary", side_effect=fake_summary),
    ):
        yield render


@contextmanager
def _as_mcp_user(user_id: str):
    token = current_mcp_user_var.set(user_id)
    try:
        yield
    finally:
        current_mcp_user_var.reset(token)


def _http_error(status: int) -> HttpError:
    return HttpError(Response({"status": status}), b"{}")


# --- Fix 1: failed background syncs are recorded, retried and reported ---


def test_error_classification():
    assert docs.sync.is_retryable_error(ValueError("expired credentials")) is False
    assert docs.sync.is_retryable_error(_http_error(403)) is False
    assert docs.sync.is_retryable_error(_http_error(503)) is True
    assert docs.sync.is_retryable_error(TimeoutError()) is True


@pytest.mark.asyncio
async def test_failed_realtime_sync_is_recorded_retried_and_cleared():
    user_id = "user_health_realtime"
    integration = await _make_integration(user_id, weekly_enabled=False, monthly_enabled=False)
    await Task(user_id=user_id, title="Done task", status="done").insert()

    with _fake_google(render_error=_http_error(503)):
        assert await docs.realtime.sync_task_realtime(user_id) is False

    stored = await Integration.get(integration.id)
    assert stored.cadence.table_sync_pending is True
    assert stored.cadence.last_sync_error_retryable is True
    assert stored.cadence.last_sync_error

    # The scheduler retries the table even though nothing else is due
    due = find_due_jobs(stored.cadence, datetime(2026, 10, 12, 10, 0, tzinfo=UTC))
    assert due.retry_table and due.cadence_type == "daily_table"

    with _fake_google() as render:
        await run_due_jobs(datetime(2026, 10, 12, 10, 0, tzinfo=UTC))
    # The tick covers every user in the shared test database; count only this one's renders
    doc_ids = [c.kwargs["document_id"] for c in render.call_args_list]
    assert doc_ids.count(f"doc_{user_id}") == 1

    stored = await Integration.get(integration.id)
    assert stored.cadence.table_sync_pending is False
    assert stored.cadence.last_sync_error is None


@pytest.mark.asyncio
async def test_failed_retry_backs_off_and_keeps_error():
    user_id = "user_health_backoff"
    integration = await _make_integration(
        user_id, weekly_enabled=False, monthly_enabled=False, table_sync_pending=True
    )
    await Task(user_id=user_id, title="Task").insert()
    now = datetime(2026, 10, 12, 10, 0, tzinfo=UTC)

    failing = AsyncMock(side_effect=ValueError("Google authentication credentials are invalid"))
    with patch.object(docs.sync, "sync_sprint_to_doc", failing):
        await run_due_jobs(now)
        await run_due_jobs(now + timedelta(minutes=5))  # inside the back-off window
    assert [c.kwargs["user_id"] for c in failing.call_args_list].count(user_id) == 1

    stored = await Integration.get(integration.id)
    assert stored.cadence.table_sync_pending is True
    assert stored.cadence.auto_sync_failures == 1
    assert stored.cadence.last_sync_error_retryable is False
    assert "credentials" in stored.cadence.last_sync_error


@pytest.mark.asyncio
async def test_mcp_tools_warn_about_failed_background_sync():
    user_id = "user_health_mcp_warning"
    await _make_integration(
        user_id,
        last_sync_error="Google authentication credentials are invalid or expired.",
        last_sync_error_at=datetime.now(UTC) - timedelta(hours=3),
        last_sync_error_retryable=False,
    )
    await Task(user_id=user_id, title="Some task").insert()

    with _as_mcp_user(user_id):
        listing = await get_tasks()
    assert "Google Docs is out of date" in listing
    assert "3 h ago" in listing
    assert "Reconnect Google Docs" in listing

    # A successful sync repairs the document and clears the warning
    with _as_mcp_user(user_id), _fake_google():
        result = await sync_docs()
        assert "Sync Successful" in result
        assert "out of date:" not in result
        assert "Google Docs is out of date" not in await get_tasks()


@pytest.mark.asyncio
async def test_web_status_exposes_background_sync_error(client):
    user_id = "mock_user_health_status"
    await _make_integration(
        user_id, last_sync_error="Docs API unavailable", last_sync_error_at=datetime.now(UTC)
    )
    res = await client.get(
        "/api/v1/integrations/google/status", headers={"Authorization": f"Bearer {user_id}"}
    )
    cadence = res.json()["cadence"]
    assert cadence["last_sync_error"] == "Docs API unavailable"
    assert cadence["last_sync_error_retryable"] is True


# --- Fix 2: summaries option ---


@pytest.mark.asyncio
async def test_sync_docs_weekly_only_uses_only_the_weekly_quota():
    user_id = "user_health_weekly_only"
    integration = await _make_integration(user_id)
    await Task(user_id=user_id, title="Task").insert()

    with _as_mcp_user(user_id), _fake_google() as render:
        result = await sync_docs(summaries="weekly")
        assert render.call_args.kwargs["cadence_type"] == "weekly_summary"

    assert "1 weekly, 2 monthly" in result
    stored = await Integration.get(integration.id)
    assert stored.cadence.manual_syncs_this_week == 1
    assert stored.cadence.manual_syncs_this_month == 0


@pytest.mark.asyncio
async def test_sync_docs_rejects_unknown_summaries_value():
    with _as_mcp_user("user_health_bad_option"):
        result = await sync_docs(summaries="yearly")  # type: ignore[arg-type]
    assert "must be" in result


# --- Fix 3: summary status in sync_docs output ---


@pytest.mark.asyncio
async def test_sync_docs_reports_summary_status():
    user_id = "user_health_summary_status"
    await _make_integration(user_id, weekly_day="Friday")
    await Task(user_id=user_id, title="First").insert()

    with _as_mcp_user(user_id), _fake_google():
        before = await sync_docs()
        assert "summary" in before and "not written yet (1 task(s))" in before
        assert "Friday at 18:00" in before

        await sync_docs(summaries="weekly")
        await Task(user_id=user_id, title="Logged later").insert()
        after = await sync_docs()

    assert "out of date, written about 1 task(s), 2 logged now" in after
    assert 'sync_docs(summaries="weekly")' in after
    assert "dossier: not written yet" in after


@pytest.mark.asyncio
async def test_sync_docs_limit_message_still_includes_summary_status():
    user_id = "user_health_limit_status"
    await _make_integration(user_id, manual_syncs_this_week=2)
    await Task(user_id=user_id, title="Task").insert()

    with _as_mcp_user(user_id), _fake_google():
        result = await sync_docs(summaries="weekly")
    assert "limit reached" in result
    assert "**Summaries:**" in result
