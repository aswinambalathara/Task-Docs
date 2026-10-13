import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.services.ai_service import AIService


async def _create_task(client: AsyncClient, headers: dict) -> str:
    res = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Quota test task", "status": "done", "priority": "medium"},
    )
    assert res.status_code in (200, 201)
    return res.json()["id"]


def _fake_gemini(source: str):
    async def generate_summary(**kwargs):
        return "Fake summary", source

    return generate_summary


@pytest.mark.asyncio
async def test_preview_limit_blocks_after_daily_quota(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(AIService, "generate_summary", _fake_gemini("gemini-2.0-flash"))
    headers = {"Authorization": "Bearer mock_user_quota_limit"}
    task_id = await _create_task(client, headers)
    limit = settings.AI_PREVIEW_DAILY_LIMIT

    for expected_remaining in range(limit - 1, -1, -1):
        res = await client.post(
            "/api/v1/ai/summarize", headers=headers, json={"task_ids": [task_id]}
        )
        assert res.status_code == 200
        assert res.json()["remaining_previews"] == expected_remaining

    blocked = await client.post(
        "/api/v1/ai/summarize", headers=headers, json={"task_ids": [task_id]}
    )
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0

    quota = await client.get("/api/v1/ai/preview-quota", headers=headers)
    assert quota.status_code == 200
    assert quota.json()["remaining"] == 0
    assert quota.json()["limit"] == limit

    # Another user's quota is untouched
    other = await client.get(
        "/api/v1/ai/preview-quota", headers={"Authorization": "Bearer mock_user_quota_other"}
    )
    assert other.json()["remaining"] == limit


@pytest.mark.asyncio
async def test_fallback_summary_does_not_use_quota(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(AIService, "generate_summary", _fake_gemini("deterministic_fallback"))
    headers = {"Authorization": "Bearer mock_user_quota_fallback"}
    task_id = await _create_task(client, headers)

    for _ in range(settings.AI_PREVIEW_DAILY_LIMIT + 2):
        res = await client.post(
            "/api/v1/ai/summarize", headers=headers, json={"task_ids": [task_id]}
        )
        assert res.status_code == 200
        assert res.json()["remaining_previews"] == settings.AI_PREVIEW_DAILY_LIMIT


@pytest.mark.asyncio
async def test_own_api_key_is_not_metered(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(AIService, "generate_summary", _fake_gemini("gemini-2.0-flash"))
    headers = {"Authorization": "Bearer mock_user_quota_byok"}
    task_id = await _create_task(client, headers)

    for _ in range(settings.AI_PREVIEW_DAILY_LIMIT + 2):
        res = await client.post(
            "/api/v1/ai/summarize",
            headers=headers,
            json={"task_ids": [task_id], "api_key": "user-own-key"},
        )
        assert res.status_code == 200
        assert res.json()["remaining_previews"] is None

    quota = await client.get("/api/v1/ai/preview-quota", headers=headers)
    assert quota.json()["remaining"] == settings.AI_PREVIEW_DAILY_LIMIT


@pytest.mark.asyncio
async def test_failed_generation_refunds_slot(client: AsyncClient, monkeypatch):
    async def boom(**kwargs):
        raise RuntimeError("Gemini exploded")

    monkeypatch.setattr(AIService, "generate_summary", boom)
    headers = {"Authorization": "Bearer mock_user_quota_error"}
    task_id = await _create_task(client, headers)

    with pytest.raises(RuntimeError):
        await client.post("/api/v1/ai/summarize", headers=headers, json={"task_ids": [task_id]})

    quota = await client.get("/api/v1/ai/preview-quota", headers=headers)
    assert quota.json()["remaining"] == settings.AI_PREVIEW_DAILY_LIMIT


@pytest.mark.asyncio
async def test_oversized_custom_context_rejected(client: AsyncClient):
    headers = {"Authorization": "Bearer mock_user_quota_context"}
    res = await client.post(
        "/api/v1/ai/summarize",
        headers=headers,
        json={"custom_context": "x" * 1001},
    )
    assert res.status_code == 422
