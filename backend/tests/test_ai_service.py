from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.models.task import Contribution, Task
from app.services.ai.summarizer import AIService


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
            project="Chordian",
            type="Improvement",
            status="in_progress",
        ),
        Task(
            user_id="user_ai_test",
            title="Fix flaky login",
            project="Chordian",
            type="Bug Fix",
            status="todo",
        ),
    ]

    summary = AIService.deterministic_weekly_summary(tasks)
    sections = summary.split("\n\n")
    assert sections[1] == "Shipped\n• Fixed CoreSignal API parameter issue"
    assert sections[2] == "In progress\n• Add Log Rotation"
    assert sections[3] == "Up next\n• Fix flaky login"
    # Unfinished bugs aren't counted as shipped, and evidence stays in the ledger table
    assert sections[-1] == "By the numbers\n1 done · 1 in progress · 1 planned · 1 bug fix shipped"
    assert "PR #245" not in summary
    assert "Blockers" not in summary


def test_deterministic_weekly_summary_truncates_long_lists():
    tasks = [Task(user_id="u", title=f"Task {i}", status="done") for i in range(12)]
    summary = AIService.deterministic_weekly_summary(tasks)
    assert "• Task 7" in summary
    assert "• Task 8" not in summary
    assert "• …and 4 more" in summary


def test_deterministic_monthly_dossier():
    tasks = [
        Task(
            user_id="user_ai_test",
            title="Routine cleanup",
            project="Chordian",
            type="Improvement",
            status="done",
            priority="low",
        ),
        Task(
            user_id="user_ai_test",
            title="Implemented deduplication engine",
            project="Chordian",
            type="Feature",
            status="done",
            outcome="Reduced duplicates by 30%",
            evidence="PR #241",
            is_career_highlight=True,
        ),
        Task(user_id="user_ai_test", title="Search revamp", project="Chordian", status="in_progress"),
    ]
    dossier = AIService.deterministic_monthly_dossier(tasks)
    # Starred work leads the highlights
    assert (
        "Highlights\n• Implemented deduplication engine: Reduced duplicates by 30%\n• Routine cleanup"
        in dossier
    )
    assert "Carried into next month\n• Search revamp (in progress)" in dossier
    assert "projects: Chordian" in dossier
    assert "Learning" not in dossier


def test_deterministic_yearly_summary():
    tasks = [
        Task(user_id="u", title="A", project="Tethr", status="done", date=datetime(2026, 1, 5, tzinfo=UTC)),
        Task(user_id="u", title="B", project="Tethr", status="todo", date=datetime(2026, 3, 5, tzinfo=UTC)),
        Task(
            user_id="u",
            title="Launch",
            project="Chordian",
            status="done",
            is_career_highlight=True,
            date=datetime(2026, 6, 1, tzinfo=UTC),
        ),
    ]
    summary = AIService.deterministic_yearly_summary(tasks, 2026)
    assert summary.startswith("3 contribution(s) logged across 3 month(s) in 2026.")
    assert "• Tethr: 2 contribution(s), 1 done\n• Chordian: 1 contribution(s), 1 done" in summary
    assert "Career highlights\n• Launch (Jun)" in summary


@pytest.mark.asyncio
async def test_ai_service_fallback_without_key(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
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
    assert "Month at a glance" in dossier


@pytest.mark.asyncio
async def test_ai_summarize_endpoint(client: AsyncClient, user_a_headers: dict, monkeypatch):
    # Never call the real Gemini API from tests
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
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
    assert data["source"] == "deterministic_fallback"

    # Request monthly dossier mode
    monthly_res = await client.post(
        "/api/v1/ai/summarize",
        headers=user_a_headers,
        json={"task_ids": [task_id], "mode": "monthly"},
    )
    assert monthly_res.status_code == 200
    monthly_data = monthly_res.json()
    assert "Month at a glance" in monthly_data["executive_summary"]
