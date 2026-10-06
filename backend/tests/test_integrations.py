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

    # Ensure offset-naive datetimes from MongoDB BSON do not raise TypeError
    integration.cadence.week_cycle_started_at = datetime.now()  # Naive (no tzinfo)
    integration.cadence.month_cycle_started_at = datetime.now()  # Naive (no tzinfo)
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

    # Create new Google Doc via API
    with patch.object(
        GoogleDocsService,
        "create_ledger_document",
        return_value={
            "doc_id": "auto_created_doc_789",
            "title": "Tethr — Developer Contribution Ledger",
            "doc_url": "https://docs.google.com/document/d/auto_created_doc_789/edit",
        },
    ):
        create_doc_resp = await client.post(
            "/api/v1/integrations/google/create-doc",
            headers=user_a_headers,
            json={"title": "Tethr — Developer Contribution Ledger"},
        )
        assert create_doc_resp.status_code == 200
        doc_data = create_doc_resp.json()
        assert doc_data["success"] is True
        assert doc_data["doc_id"] == "auto_created_doc_789"
        assert "auto_created_doc_789" in doc_data["doc_url"]

    # Disconnect
    del_resp = await client.delete("/api/v1/integrations/google/disconnect", headers=user_a_headers)
    assert del_resp.status_code == 204

    # Status should now be disconnected
    post_del_resp = await client.get("/api/v1/integrations/google/status", headers=user_a_headers)
    assert post_del_resp.json()["connected"] is False


def test_weekly_and_monthly_summary_scheduling_edge_cases():
    from datetime import date

    # Week: Monday Jan 5, 2026 to Sunday Jan 11, 2026
    week = {
        "week_num": 2,
        "start_date": date(2026, 1, 5),
        "end_date": date(2026, 1, 11),
    }

    # Case 1: Weekly enabled with Friday as preferred day (Friday is Jan 9, 2026)
    cadence_friday = SyncCadence(weekly_enabled=True, weekly_day="Friday")

    # Before preferred day (Thursday Jan 8) -> should NOT render
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week,
            cadence=cadence_friday,
            cadence_type="daily_table",
            today=date(2026, 1, 8),
        )
        is False
    )

    # On preferred day (Friday Jan 9) -> SHOULD render
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week,
            cadence=cadence_friday,
            cadence_type="daily_table",
            today=date(2026, 1, 9),
        )
        is True
    )

    # After preferred day (Saturday Jan 10) -> SHOULD render
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week,
            cadence=cadence_friday,
            cadence_type="daily_table",
            today=date(2026, 1, 10),
        )
        is True
    )

    # Completed past week (e.g. today is Jan 15) -> SHOULD render
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week,
            cadence=cadence_friday,
            cadence_type="daily_table",
            today=date(2026, 1, 15),
        )
        is True
    )

    # Future week (today is Jan 2) -> should NOT render
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week,
            cadence=cadence_friday,
            cadence_type="daily_table",
            today=date(2026, 1, 2),
        )
        is False
    )

    # Case 2: Weekly disabled
    cadence_disabled = SyncCadence(weekly_enabled=False, weekly_day="Friday")
    # Even on preferred day or after week ended, automated daily sync will NOT render
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week,
            cadence=cadence_disabled,
            cadence_type="daily_table",
            today=date(2026, 1, 9),
        )
        is False
    )
    # But manual trigger on target week SHOULD render
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week,
            cadence=cadence_disabled,
            cadence_type="weekly_summary",
            today=date(2026, 1, 8),
            is_target_week=True,
        )
        is True
    )
    # And cached summary SHOULD be preserved
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week,
            cadence=cadence_disabled,
            cadence_type="daily_table",
            today=date(2026, 1, 8),
            has_cached_summary=True,
        )
        is True
    )

    # Case 3: Week slice where preferred day doesn't exist (e.g. Week 5 is Mon Jan 26 to Sat Jan 31; preferred is Sunday)
    week_short = {
        "week_num": 5,
        "start_date": date(2026, 1, 26),
        "end_date": date(2026, 1, 31),
    }
    cadence_sunday = SyncCadence(weekly_enabled=True, weekly_day="Sunday")
    # Sunday doesn't exist in Jan 26-Jan 31 (Sunday is Feb 1), so falls back to week end_date (Jan 31)
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week_short,
            cadence=cadence_sunday,
            cadence_type="daily_table",
            today=date(2026, 1, 30),
        )
        is False
    )
    assert (
        GoogleDocsService.should_render_weekly_summary(
            week=week_short,
            cadence=cadence_sunday,
            cadence_type="daily_table",
            today=date(2026, 1, 31),
        )
        is True
    )

    # Case 4: Monthly Summary Scheduling
    cadence_month_enabled = SyncCadence(monthly_enabled=True)

    # Mid-month (Jan 15, 2026) -> should NOT render monthly summary
    assert (
        GoogleDocsService.should_render_monthly_summary(
            year=2026,
            month=1,
            cadence=cadence_month_enabled,
            cadence_type="daily_table",
            today=date(2026, 1, 15),
        )
        is False
    )

    # End of month (Jan 31, 2026) -> SHOULD render monthly summary
    assert (
        GoogleDocsService.should_render_monthly_summary(
            year=2026,
            month=1,
            cadence=cadence_month_enabled,
            cadence_type="daily_table",
            today=date(2026, 1, 31),
        )
        is True
    )

    # Past completed month (e.g. evaluating Jan 2026 when today is Feb 10, 2026) -> SHOULD render
    assert (
        GoogleDocsService.should_render_monthly_summary(
            year=2026,
            month=1,
            cadence=cadence_month_enabled,
            cadence_type="daily_table",
            today=date(2026, 2, 10),
        )
        is True
    )

    # Future month (e.g. evaluating March 2026 when today is Jan 15, 2026) -> should NOT render
    assert (
        GoogleDocsService.should_render_monthly_summary(
            year=2026,
            month=3,
            cadence=cadence_month_enabled,
            cadence_type="daily_table",
            today=date(2026, 1, 15),
        )
        is False
    )

    # Case 5: Monthly disabled
    cadence_month_disabled = SyncCadence(monthly_enabled=False)
    # Automated daily sync at end of month -> should NOT render
    assert (
        GoogleDocsService.should_render_monthly_summary(
            year=2026,
            month=1,
            cadence=cadence_month_disabled,
            cadence_type="daily_table",
            today=date(2026, 1, 31),
        )
        is False
    )

    # Manual trigger for target month -> SHOULD render
    assert (
        GoogleDocsService.should_render_monthly_summary(
            year=2026,
            month=1,
            cadence=cadence_month_disabled,
            cadence_type="monthly_dossier",
            today=date(2026, 1, 15),
            is_target_month=True,
        )
        is True
    )

    # Cached monthly summary -> SHOULD be preserved
    assert (
        GoogleDocsService.should_render_monthly_summary(
            year=2026,
            month=1,
            cadence=cadence_month_disabled,
            cadence_type="daily_table",
            today=date(2026, 1, 15),
            has_cached_summary=True,
        )
        is True
    )

