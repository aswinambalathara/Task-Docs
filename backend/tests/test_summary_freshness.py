from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from beanie import PydanticObjectId
from httpx import AsyncClient

from app.core.security import encrypt_token
from app.models.integration import GoogleTokens, Integration, SummaryMeta, SyncCadence
from app.models.task import Task
from app.services import docs
from app.services.ai.prompts import SUMMARY_FORMAT_VERSION
from app.services.ai.summarizer import AIService
from app.services.docs import periods
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
def _fake_google(summaries: list[tuple[str, list[str]]] | None = None):
    """Stubs Google and Gemini; records (mode, task titles) per generated summary."""

    async def fake_summary(tasks, mode="weekly", **_):
        if summaries is not None:
            summaries.append((mode, sorted(t.title for t in tasks)))
        return f"{mode} summary of {len(tasks)} task(s)", "gemini-2.5-flash"

    render = MagicMock()
    with (
        patch.object(docs.oauth, "get_credentials", AsyncMock(return_value=object())),
        patch("app.services.docs.renderer.build", return_value=object()),
        patch.object(docs.renderer, "render_structured_ledger_document", render),
        patch.object(AIService, "generate_summary", side_effect=fake_summary),
    ):
        yield render


def _headers(user_id: str) -> dict:
    return {"Authorization": f"Bearer {user_id}"}


# --- Pure helpers ---


def test_fingerprint_ignores_order_and_changes_with_task_set():
    a, b, c = (Task(id=PydanticObjectId(), user_id="u", title=t) for t in "abc")
    assert periods.fingerprint([a, b]) == periods.fingerprint([b, a])
    assert periods.fingerprint([a, b]) != periods.fingerprint([a, b, c])


def test_stale_keys_include_old_formats_and_sort_newest_first():
    def task(day: datetime) -> Task:
        return Task(id=PydanticObjectId(), user_id="u", title="t", date=day)

    def meta_for(fp: str, version: int = SUMMARY_FORMAT_VERSION) -> SummaryMeta:
        return SummaryMeta(fingerprint=fp, format_version=version)

    sep = task(datetime(2026, 9, 10))
    oct_w1 = task(datetime(2026, 10, 1))
    oct_w2 = task(datetime(2026, 10, 6))
    tasks = [sep, oct_w1, oct_w2]
    meta = {
        # Written before oct_w2 existed
        "monthly:2026:10": meta_for(periods.fingerprint([oct_w1])),
        "weekly:2026:10:2": meta_for("outdated"),
        "weekly:2026:10:1": meta_for(periods.fingerprint([oct_w1])),
        # Same tasks, but written in an older format
        "weekly:2026:9:2": meta_for(periods.fingerprint([sep]), version=0),
    }
    cached = {k: "text" for k in meta} | {
        "weekly:2026:8:1": "legacy, no fingerprint",
        "not-a-period": "ignored",
    }

    assert periods.stale_summary_keys(cached, meta, tasks) == [
        "monthly:2026:10",
        "weekly:2026:10:2",
        "weekly:2026:9:2",
        "weekly:2026:8:1",
    ]


# --- ISSUE-002: summaries know which tasks they cover ---


@pytest.mark.asyncio
async def test_new_task_marks_weekly_summary_stale(client: AsyncClient):
    user_id = "mock_user_fresh_status"
    await _make_integration(user_id)
    await Task(user_id=user_id, title="First task").insert()

    with _fake_google():
        await docs.sync.sync_sprint_to_doc(
            user_id=user_id, cadence_type="weekly_summary", force=True
        )

    res = await client.get("/api/v1/integrations/google/summary-status", headers=_headers(user_id))
    assert res.status_code == 200
    weekly = res.json()["weekly"]
    assert weekly["generated"] is True
    assert weekly["stale"] is False
    assert weekly["summarized_task_count"] == 1

    await Task(user_id=user_id, title="Logged after the summary").insert()

    weekly = (
        await client.get("/api/v1/integrations/google/summary-status", headers=_headers(user_id))
    ).json()["weekly"]
    assert weekly["stale"] is True
    assert weekly["summarized_task_count"] == 1
    assert weekly["current_task_count"] == 2


@pytest.mark.asyncio
async def test_refresh_rewrites_only_stale_summaries_and_renders_once():
    user_id = "user_fresh_refresh"
    await _make_integration(user_id)
    await Task(user_id=user_id, title="Early task").insert()

    with _fake_google():
        await docs.sync.sync_sprint_to_doc(user_id=user_id, cadence_type="all", force=True)

    # Nothing changed yet: no Gemini call, no render
    seen: list[tuple[str, list[str]]] = []
    with _fake_google(seen) as render:
        assert await docs.summaries.refresh_stale_summaries(user_id) == 0
        assert seen == [] and render.call_count == 0

    await Task(user_id=user_id, title="Late task").insert()

    with _fake_google(seen) as render:
        assert await docs.summaries.refresh_stale_summaries(user_id) == 2
        assert render.call_count == 1

    assert sorted(seen) == [
        ("monthly", ["Early task", "Late task"]),
        ("weekly", ["Early task", "Late task"]),
    ]
    stored = await Integration.find_one({"user_id": user_id})
    period_keys = [k for k in stored.cached_summaries if k.startswith("weekly:")]
    assert stored.cached_summaries[period_keys[0]] == "weekly summary of 2 task(s)"

    status = await docs.summaries.get_summary_status(user_id)
    assert status["weekly"]["stale"] is False
    assert status["monthly"]["stale"] is False


@pytest.mark.asyncio
async def test_refresh_rewrites_summaries_saved_in_an_older_format():
    user_id = "user_fresh_old_format"
    await _make_integration(user_id)
    await Task(user_id=user_id, title="Unchanged task").insert()

    with _fake_google():
        await docs.sync.sync_sprint_to_doc(
            user_id=user_id, cadence_type="weekly_summary", force=True
        )

    # Simulate a summary saved before format versions existed, and one with no metadata at all
    stored = await Integration.find_one({"user_id": user_id})
    key = next(k for k in stored.cached_summaries if k.startswith("weekly:"))
    stored.cached_summaries[key] = "old messy summary"
    stored.summary_meta[key].format_version = 0
    stored.cached_summaries["weekly:2026:1:1"] = "legacy summary"
    await Task(
        user_id=user_id, title="January task", date=datetime(2026, 1, 1, 12, tzinfo=UTC)
    ).insert()
    await stored.save()

    seen: list[tuple[str, list[str]]] = []
    with _fake_google(seen) as render:
        assert await docs.summaries.refresh_stale_summaries(user_id) == 2
        assert render.call_count == 1
    assert sorted(seen) == [("weekly", ["January task"]), ("weekly", ["Unchanged task"])]

    stored = await Integration.find_one({"user_id": user_id})
    assert stored.cached_summaries[key] == "weekly summary of 1 task(s)"
    assert stored.summary_meta[key].format_version == SUMMARY_FORMAT_VERSION

    # Up to date now: the next night does nothing
    with _fake_google() as render:
        assert await docs.summaries.refresh_stale_summaries(user_id) == 0


@pytest.mark.asyncio
async def test_refresh_drops_summary_when_all_its_tasks_are_deleted():
    user_id = "user_fresh_deleted"
    await _make_integration(user_id)
    only = Task(user_id=user_id, title="Will be deleted")
    await only.insert()

    with _fake_google():
        await docs.sync.sync_sprint_to_doc(
            user_id=user_id, cadence_type="weekly_summary", force=True
        )
    await only.delete()

    with _fake_google() as render:
        assert await docs.summaries.refresh_stale_summaries(user_id) == 1
        assert render.call_count == 1

    stored = await Integration.find_one({"user_id": user_id})
    assert stored.cached_summaries == {}
    assert stored.summary_meta == {}


@pytest.mark.asyncio
async def test_previewed_text_keeps_the_fingerprint_it_was_written_about():
    user_id = "user_fresh_preview_fp"
    await _make_integration(user_id)
    await Task(user_id=user_id, title="Task").insert()

    with _fake_google() as render:
        await docs.sync.sync_sprint_to_doc(
            user_id=user_id,
            cadence_type="weekly_summary",
            executive_summary="Previewed text",
            weekly_fingerprint="fp-from-an-older-preview",
            force=True,
        )
        assert render.call_args.kwargs["weekly_summary"] == "Previewed text"

    status = await docs.summaries.get_summary_status(user_id)
    # The preview covered a different task set, so the summary is already out of date
    assert status["weekly"]["stale"] is True
    assert status["weekly"]["summarized_task_count"] is None


# --- ISSUE-003: weekly and monthly texts never mix ---


@pytest.mark.asyncio
async def test_monthly_preview_is_stored_as_monthly_not_weekly():
    user_id = "user_fresh_monthly_text"
    await _make_integration(user_id)
    await Task(user_id=user_id, title="Task").insert()

    seen: list[tuple[str, list[str]]] = []
    with _fake_google(seen) as render:
        await docs.sync.sync_sprint_to_doc(
            user_id=user_id,
            cadence_type="monthly_dossier",
            # Old clients sent the monthly preview here; it must not become a weekly summary
            executive_summary="Monthly text sent the old way",
            monthly_dossier="Previewed monthly dossier",
            force=True,
        )
        kwargs = render.call_args.kwargs
        assert kwargs["weekly_summary"] is None
        assert kwargs["monthly_dossier"] == "Previewed monthly dossier"

    assert seen == []  # the previewed dossier was used, nothing regenerated
    stored = await Integration.find_one({"user_id": user_id})
    assert list(stored.cached_summaries.values()) == ["Previewed monthly dossier"]
    assert all(k.startswith("monthly:") for k in stored.cached_summaries)


@pytest.mark.asyncio
async def test_weekly_and_monthly_sync_uses_both_previews(client: AsyncClient):
    user_id = "mock_user_fresh_both"
    await _make_integration(user_id)
    await Task(user_id=user_id, title="Task").insert()

    seen: list[tuple[str, list[str]]] = []
    with _fake_google(seen) as render:
        res = await client.post(
            "/api/v1/integrations/google/sync",
            headers=_headers(user_id),
            json={
                "cadence_type": "all",
                "executive_summary": "Weekly preview",
                "monthly_dossier": "Monthly preview",
            },
        )
        assert res.status_code == 200, res.text
        kwargs = render.call_args.kwargs
        assert kwargs["weekly_summary"] == "Weekly preview"
        assert kwargs["monthly_dossier"] == "Monthly preview"
    assert seen == []


# --- Previews cover the same tasks as the sync ---


@pytest.mark.asyncio
async def test_preview_without_task_ids_covers_this_weeks_tasks(client: AsyncClient):
    user_id = "mock_user_fresh_preview_scope"
    await _make_integration(user_id)
    await Task(user_id=user_id, title="This week").insert()
    await Task(
        user_id=user_id, title="Long ago", date=datetime.now(UTC) - timedelta(days=60)
    ).insert()

    seen: list[tuple[str, list[str]]] = []
    with _fake_google(seen):
        res = await client.post(
            "/api/v1/ai/summarize", headers=_headers(user_id), json={"mode": "weekly"}
        )
    assert res.status_code == 200, res.text
    assert seen == [("weekly", ["This week"])]

    week = await docs.summaries.get_period_tasks(user_id, "weekly")
    assert res.json()["fingerprint"] == periods.fingerprint(week)


# --- Nightly scheduler job ---


def test_refresh_due_nightly_at_end_of_day():
    cadence = SyncCadence(weekly_enabled=False, monthly_enabled=False)
    assert find_due_jobs(cadence, datetime(2026, 10, 12, 22, 59, tzinfo=IST)).refresh is None
    assert find_due_jobs(cadence, datetime(2026, 10, 12, 23, 0, tzinfo=IST)).refresh == "2026-10-12"
    cadence.last_refresh_period = "2026-10-12"
    assert find_due_jobs(cadence, datetime(2026, 10, 12, 23, 30, tzinfo=IST)).refresh is None


@pytest.mark.asyncio
async def test_tick_runs_refresh_once_and_failures_do_not_block_other_jobs():
    user_id = "user_fresh_tick"
    integration = await _make_integration(user_id, timezone="Asia/Kolkata", monthly_enabled=False)
    await Task(user_id=user_id, title="Task").insert()

    # Saturday 2026-10-10 17:35 UTC = 23:05 IST: weekly summary and nightly refresh both due
    now = datetime(2026, 10, 10, 17, 35, tzinfo=UTC)
    sync = AsyncMock(return_value={"success": True})
    refresh = AsyncMock(side_effect=RuntimeError("Docs API down"))
    with (
        patch.object(docs.sync, "sync_sprint_to_doc", sync),
        patch.object(docs.summaries, "refresh_stale_summaries", refresh),
    ):
        await run_due_jobs(now)
        await run_due_jobs(now + timedelta(minutes=10))

    assert [c.kwargs["user_id"] for c in sync.call_args_list].count(user_id) == 1
    assert [c.args[0] for c in refresh.call_args_list].count(user_id) == 1

    stored = await Integration.get(integration.id)
    assert stored.cadence.last_weekly_period == "2026-W41"
    # A failed refresh waits for the next night instead of retrying every tick
    assert stored.cadence.last_refresh_period == "2026-10-10"
    assert stored.cadence.auto_sync_failures == 0
