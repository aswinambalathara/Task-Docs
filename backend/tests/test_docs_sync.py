import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from app.core.security import encrypt_token
from app.models.integration import GoogleTokens, Integration
from app.models.task import Task
from app.services.ai_service import AIService
from app.services.google_docs import GoogleDocsService


@pytest.mark.asyncio
async def test_realtime_sync_coalesces_rapid_changes():
    calls = 0
    release = asyncio.Event()

    async def fake_sync(user_id):
        nonlocal calls
        calls += 1
        await release.wait()
        return True

    with patch.object(GoogleDocsService, "sync_task_realtime", side_effect=fake_sync):
        GoogleDocsService.schedule_realtime_sync("user_realtime_test")
        await asyncio.sleep(0)  # first sync is now running
        for _ in range(4):
            GoogleDocsService.schedule_realtime_sync("user_realtime_test")
        release.set()
        while "user_realtime_test" in GoogleDocsService._realtime_running:
            await asyncio.sleep(0)

    # First run + exactly one follow-up for the four changes made while it was running
    assert calls == 2


@pytest.mark.asyncio
async def test_sync_summaries_use_target_period_or_selected_tasks():
    user_id = "user_summary_scope"
    await Integration(
        user_id=user_id,
        target_doc_id="doc_scope",
        google_tokens=GoogleTokens(
            access_token="x", refresh_token=encrypt_token("r"), expiry_date=0
        ),
    ).insert()
    now = datetime.now(UTC)
    current = Task(user_id=user_id, title="This week work", date=now)
    old = Task(user_id=user_id, title="Last year work", date=now - timedelta(days=400))
    await current.insert()
    await old.insert()

    seen: list[tuple[str, list[str]]] = []

    async def fake_summary(tasks, mode="weekly", **_):
        seen.append((mode, sorted(t.title for t in tasks)))
        return "summary", "deterministic_fallback"

    with (
        patch.object(GoogleDocsService, "get_credentials", AsyncMock(return_value=object())),
        patch("app.services.google_docs.build", return_value=object()),
        patch.object(GoogleDocsService, "render_structured_ledger_document"),
        patch.object(AIService, "generate_summary", side_effect=fake_summary),
    ):
        await GoogleDocsService.sync_sprint_to_doc(user_id=user_id, force=True)
        assert seen == [("weekly", ["This week work"]), ("monthly", ["This week work"])]

        seen.clear()
        await GoogleDocsService.sync_sprint_to_doc(
            user_id=user_id, task_ids=[str(old.id)], force=True
        )
        assert seen == [("weekly", ["Last year work"]), ("monthly", ["Last year work"])]

    synced = await Task.find({"user_id": user_id}).to_list()
    assert all(t.synced_to_docs for t in synced)
