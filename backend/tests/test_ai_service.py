import pytest
from httpx import AsyncClient

from app.models.task import Contribution, Task
from app.services.ai_service import AIService


def test_deterministic_weekly_summary():
    tasks = [
        Task(
            user_id="user_ai_test",
            title="Fixed CoreSignal API parameter issue",
            project="Chordian",
            type="Bug Fix",
            status="done",
            outcome="Restored enrichment requests",
            evidence="PR #245",
            contributions=[Contribution(note="Flow verified with mock")],
        ),
        Task(
            user_id="user_ai_test",
            title="Add Log Rotation",
            project="Infrastructure",
            type="Improvement",
            status="done",
            outcome="Prevented disk space overages",
        ),
    ]

    summary = AIService.deterministic_weekly_summary(tasks)
    assert "WEEKLY SUMMARY" in summary
    assert "Fixed CoreSignal API parameter issue" in summary
    assert "Restored enrichment requests" in summary
    assert "PR #245" in summary
    assert "**Issues Resolved:** 1" in summary


def test_deterministic_monthly_dossier():
    tasks = [
        Task(
            user_id="user_ai_test",
            title="Implemented deduplication engine",
            project="Chordian",
            type="Feature",
            status="done",
            outcome="Reduced duplicates by 30%",
            evidence="PR #241",
        )
    ]
    dossier = AIService.deterministic_monthly_dossier(tasks)
    assert "MONTHLY APPRAISAL DOSSIER" in dossier
    assert "Key Outcomes & Shipped Value" in dossier
    assert "Reduced duplicates by 30%" in dossier
    assert "Technical Areas & Categories Worked On" in dossier


@pytest.mark.asyncio
async def test_ai_service_fallback_without_key():
    tasks = [
        Task(
            user_id="user_ai_test",
            title="Database indexing optimization",
            status="done",
        )
    ]
    summary, source = await AIService.generate_summary(tasks=tasks, api_key="", mode="weekly")
    assert source == "deterministic_fallback"
    assert "Database indexing optimization" in summary

    dossier, d_source = await AIService.generate_summary(tasks=tasks, api_key="", mode="monthly")
    assert d_source == "deterministic_fallback"
    assert "MONTHLY APPRAISAL DOSSIER" in dossier


@pytest.mark.asyncio
async def test_ai_summarize_endpoint(client: AsyncClient, user_a_headers: dict):
    task_res = await client.post(
        "/api/v1/tasks",
        headers=user_a_headers,
        json={
            "title": "Migrate schema to Pydantic v2",
            "description": "Standardize models on v2 base settings",
            "status": "done",
            "priority": "high",
            "project": "Tethr Backend",
            "type": "Improvement",
            "outcome": "Improved serialization performance",
            "evidence": "PR #12",
        },
    )
    task_id = task_res.json()["id"]

    # Request AI summarization for the task
    ai_res = await client.post(
        "/api/v1/ai/summarize",
        headers=user_a_headers,
        json={"task_ids": [task_id]},
    )
    assert ai_res.status_code == 200
    data = ai_res.json()
    assert "executive_summary" in data
    assert data["task_count"] == 1
    assert data["source"] in ["gemini-2.0-flash", "deterministic_fallback"]

    # Request monthly dossier mode
    monthly_res = await client.post(
        "/api/v1/ai/summarize",
        headers=user_a_headers,
        json={"task_ids": [task_id], "mode": "monthly"},
    )
    assert monthly_res.status_code == 200
    monthly_data = monthly_res.json()
    assert "MONTHLY APPRAISAL DOSSIER" in monthly_data["executive_summary"]
