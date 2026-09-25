from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.core.security import encrypt_token
from app.models.integration import GoogleTokens, Integration, SyncCadence
from app.models.task import Task
from app.schemas.sync import TargetDocUpdateRequest
from app.services.google_docs import GoogleDocsService


def test_target_doc_id_extraction():
    plain_req = TargetDocUpdateRequest(target_doc_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms")
    assert plain_req.target_doc_id == "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

    url_req = TargetDocUpdateRequest(
        target_doc_id="https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?tab=t.0"
    )
    assert url_req.target_doc_id == "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"


def test_build_daily_contribution_log_table():
    tasks = [
        Task(
            user_id="user_test",
            title="Fixed CoreSignal API parameter issue",
            project="Chordian",
            area="Enrichment",
            type="Bug Fix",
            priority="high",
            status="done",
            outcome="Restored enrichment requests",
            evidence="PR #245",
            requested_by="Oliver",
        )
    ]
    table = GoogleDocsService.build_daily_contribution_log_table(tasks)

    assert "DAILY CONTRIBUTION LOG" in table
    assert (
        "| Date | Project | Area | Contribution | Type | Priority | Requested By | Status | Outcome | Evidence |"
        in table
    )
    assert "Chordian" in table
    assert "Enrichment" in table
    assert "Fixed CoreSignal API parameter issue" in table
    assert "Restored enrichment requests" in table
    assert "PR #245" in table


def test_rate_limit_enforcement():
    integration = Integration(
        user_id="test_rate_limit_user",
        provider="google_docs",
        target_doc_id="doc_123",
        google_tokens=GoogleTokens(access_token="tok", refresh_token="ref", expiry_date=9999999999),
        cadence=SyncCadence(
            manual_syncs_this_week=0,
            manual_syncs_this_month=0,
            max_manual_syncs_per_cycle=2,
        ),
    )

    # First manual run
    rem_w, rem_m = GoogleDocsService.check_and_update_rate_limit(integration)
    assert rem_w == 1
    assert rem_m == 1

    # Second manual run
    rem_w, rem_m = GoogleDocsService.check_and_update_rate_limit(integration)
    assert rem_w == 0
    assert rem_m == 0

    # Third manual run should be blocked for weekly summaries
    with pytest.raises(ValueError, match="Weekly manual sync limit reached"):
        GoogleDocsService.check_and_update_rate_limit(integration, cadence_type="weekly_summary")

    # But daily_table sync is not rate-limited
    rem_w_daily, rem_m_daily = GoogleDocsService.check_and_update_rate_limit(
        integration, cadence_type="daily_table"
    )
    assert rem_w_daily == 0
    assert rem_m_daily == 0

    # And force=True bypasses rate limiting for automated cron jobs
    rem_w, rem_m = GoogleDocsService.check_and_update_rate_limit(integration, force=True)
    assert rem_w == 0


@pytest.mark.asyncio
async def test_get_integration_status_disconnected(client: AsyncClient, user_a_headers: dict):
    response = await client.get("/api/v1/integrations/google/status", headers=user_a_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["connected"] is False


@pytest.mark.asyncio
async def test_get_auth_url(client: AsyncClient, user_a_headers: dict):
    response = await client.get("/api/v1/integrations/google/auth-url", headers=user_a_headers)
    assert response.status_code == 200
    data = response.json()
    assert "accounts.google.com" in data["auth_url"]


@pytest.mark.asyncio
async def test_integration_flow_with_cadence(client: AsyncClient, user_a_headers: dict):
    user_id = "mock_user_alice"

    encrypted_refresh = encrypt_token("mock_google_refresh_token_123")
    integration = Integration(
        user_id=user_id,
        provider="google_docs",
        target_doc_id="test_doc_id_999",
        target_doc_title="Engineering Sprint Log",
        google_tokens=GoogleTokens(
            access_token="mock_access_token",
            refresh_token=encrypted_refresh,
            expiry_date=int(datetime.now(UTC).timestamp() * 1000) + 3600000,
        ),
        cadence=SyncCadence(
            manual_syncs_this_week=0,
            manual_syncs_this_month=0,
            max_manual_syncs_per_cycle=2,
        ),
    )
    await integration.save()

    # Check status endpoint - returns cadence and remaining manual runs
    response = await client.get("/api/v1/integrations/google/status", headers=user_a_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["connected"] is True
    assert data["target_doc_id"] == "test_doc_id_999"
    assert data["remaining_manual_syncs_week"] == 2
    assert data["remaining_manual_syncs_month"] == 2

    # Update target doc
    with patch.object(
        GoogleDocsService,
        "get_target_doc_info",
        return_value={"title": "Updated Sprint Doc", "id": "new_doc_456"},
    ):
        update_resp = await client.post(
            "/api/v1/integrations/google/target-doc",
            headers=user_a_headers,
            json={"target_doc_id": "new_doc_456"},
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["target_doc_id"] == "new_doc_456"

    # Update cadence settings (e.g. daily table to end_of_day)
    cadence_patch_resp = await client.patch(
        "/api/v1/integrations/google/cadence",
        headers=user_a_headers,
        json={"daily_table_cadence": "end_of_day", "weekly_day": "Friday"},
    )
    assert cadence_patch_resp.status_code == 200
    cadence_data = cadence_patch_resp.json()["cadence"]
    assert cadence_data["daily_table_cadence"] == "end_of_day"
    assert cadence_data["weekly_day"] == "Friday"

    # Disconnect
    del_resp = await client.delete("/api/v1/integrations/google/disconnect", headers=user_a_headers)
    assert del_resp.status_code == 204

    # Status should now be disconnected
    post_del_resp = await client.get("/api/v1/integrations/google/status", headers=user_a_headers)
    assert post_del_resp.json()["connected"] is False
