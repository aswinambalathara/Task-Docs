from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.core.timezones import day_timestamp, local_day_range, parse_local_day
from app.mcp.server import add_task, current_mcp_user_var, get_tasks, update_task
from app.models.integration import GoogleTokens, Integration, SyncCadence
from app.models.task import Contribution, Task
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.tasks import TaskService

KOLKATA = ZoneInfo("Asia/Kolkata")
# 2026-10-15 in Asia/Kolkata is [2026-10-14 18:30, 2026-10-15 18:30) UTC
DAY_START = datetime(2026, 10, 14, 18, 30)
DAY_END = datetime(2026, 10, 15, 18, 30)
OLD = datetime(2026, 9, 1, 12, 0)
INSIDE = datetime(2026, 10, 15, 4, 0)


def test_parse_local_day():
    today = datetime.now(KOLKATA).date()
    assert parse_local_day("today", KOLKATA) == today
    assert parse_local_day(" Yesterday ", KOLKATA) == today - timedelta(days=1)
    assert parse_local_day("2026-10-15", KOLKATA) == date(2026, 10, 15)
    with pytest.raises(ValueError, match="YYYY-MM-DD"):
        parse_local_day("15/10/2026", KOLKATA)


def test_local_day_range():
    assert local_day_range(None, None, KOLKATA) == (None, None)
    assert local_day_range("2026-10-15", "2026-10-15", KOLKATA) == (DAY_START, DAY_END)
    assert local_day_range("2026-10-15", None, KOLKATA) == (DAY_START, None)
    assert local_day_range(None, "2026-10-15", KOLKATA) == (None, DAY_END)
    with pytest.raises(ValueError, match="after"):
        local_day_range("2026-10-16", "2026-10-15", KOLKATA)


def test_day_timestamp():
    assert day_timestamp("today", KOLKATA) is None
    # Local noon keeps the same calendar date in UTC
    assert day_timestamp("2026-01-15", KOLKATA) == datetime(2026, 1, 15, 6, 30, tzinfo=UTC)


async def _seed(user_id: str) -> dict[str, Task]:
    def task(title: str, **fields) -> Task:
        base = {"date": OLD, "created_at": OLD, "updated_at": OLD}
        return Task(user_id=user_id, title=title, **{**base, **fields})

    tasks = {
        "old": task("Old work", contributions=[Contribution(note="old note", logged_at=OLD)]),
        "noted": task(
            "Noted today",
            description="Root cause and approach",
            contributions=[
                Contribution(note="old note", logged_at=OLD),
                Contribution(note="today's note", logged_at=INSIDE),
            ],
        ),
        "completed": task("Completed today", status="done", completed_at=INSIDE),
        "dated": task("Work dated today", date=INSIDE),
        # Logged today, but the work was earlier: belongs to its work date
        "backdated": task("Logged late", created_at=INSIDE),
        # A title fix today isn't progress
        "edited": task("Edited today", updated_at=INSIDE),
        "late": task("Next local day", date=DAY_END, completed_at=DAY_END),
    }
    for t in tasks.values():
        await t.insert()
    return tasks


TODAYS = {"Noted today", "Completed today", "Work dated today"}


def _same(a: datetime | None, b: datetime) -> bool:
    # The test database stores naive UTC at millisecond precision
    naive = [d.astimezone(UTC).replace(tzinfo=None) if d.tzinfo else d for d in (a, b)]
    return abs(naive[0] - naive[1]) < timedelta(milliseconds=1)


@pytest.mark.asyncio
async def test_list_tasks_activity_window():
    user_id = "date_user_service"
    await _seed(user_id)

    tasks, total = await TaskService.list_tasks(
        user_id=user_id, active_from=DAY_START, active_to=DAY_END
    )
    assert total == 3
    assert {t.title for t in tasks} == TODAYS

    # Combines with search instead of replacing it
    tasks, total = await TaskService.list_tasks(
        user_id=user_id, search="noted", active_from=DAY_START, active_to=DAY_END
    )
    assert [t.title for t in tasks] == ["Noted today"]


@pytest.mark.asyncio
async def test_mark_synced_keeps_updated_at():
    user_id = "date_user_sync"
    tasks = await _seed(user_id)
    old = tasks["old"]

    await TaskService.mark_tasks_as_synced([str(old.id)], user_id)

    reloaded = await Task.get(old.id)
    assert reloaded.synced_to_docs is True
    assert reloaded.updated_at == OLD


@pytest.mark.asyncio
async def test_completed_at_lifecycle():
    user_id = "date_user_completion"
    yesterday = datetime.now(UTC) - timedelta(days=1)

    # Created done with a past work date: note and completion follow the work date
    backdated = await TaskService.create_task(
        user_id,
        TaskCreate(title="Done yesterday", status="done", date=yesterday, initial_contribution="n"),
    )
    assert _same(backdated.completed_at, yesterday)
    assert _same(backdated.contributions[0].logged_at, yesterday)

    task = await TaskService.create_task(user_id, TaskCreate(title="Open"))
    assert task.completed_at is None

    done = await TaskService.update_task(str(task.id), user_id, TaskUpdate(status="done"))
    first_completion = done.completed_at
    assert first_completion is not None

    # Unrelated edits keep it; reopening clears it
    edited = await TaskService.update_task(str(task.id), user_id, TaskUpdate(title="Open v2"))
    assert edited.completed_at == first_completion
    reopened = await TaskService.update_task(str(task.id), user_id, TaskUpdate(status="todo"))
    assert reopened.completed_at is None

    # Marked done late with an explicit completion time
    late = await TaskService.update_task(
        str(task.id), user_id, TaskUpdate(status="done", completed_at=yesterday)
    )
    assert _same(late.completed_at, yesterday)


@pytest.mark.asyncio
async def test_rest_date_filter(client):
    headers = {"Authorization": "Bearer mock_user_dates"}
    await _seed("mock_user_dates")

    resp = await client.get(
        "/api/v1/tasks",
        params={"date_from": "2026-10-15", "date_to": "2026-10-15", "tz": "Asia/Kolkata"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert {t["title"] for t in body["items"]} == TODAYS
    assert any(t["completed_at"] for t in body["items"])

    bad = await client.get("/api/v1/tasks", params={"date_from": "15-10-2026"}, headers=headers)
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_mcp_tools_use_dates_in_user_zone():
    user_id = "date_user_mcp"
    await _seed(user_id)
    await Integration(
        user_id=user_id,
        google_tokens=GoogleTokens(access_token="a", refresh_token="r", expiry_date=0),
        cadence=SyncCadence(timezone="Asia/Kolkata"),
    ).insert()

    token = current_mcp_user_var.set(user_id)
    try:
        result = await get_tasks(date_from="2026-10-15", date_to="2026-10-15")
        bad = await get_tasks(date_from="soon")

        # Logged today about earlier work: lands on its work date, not today
        await add_task(title="Finished in January", status="done", date="2026-01-15")
        on_day = await get_tasks(date_from="2026-01-15", date_to="2026-01-15")
        today = await get_tasks(date_from="today")

        opened = await add_task(title="Marked done late")
        task_id = opened.split("`")[1]
        marked = await update_task(task_id=task_id, status="done", completed_on="2026-01-15")
    finally:
        current_mcp_user_var.reset(token)

    assert "3 of 3 total" in result
    assert "Asia/Kolkata" in result
    assert "Next local day" not in result and "Logged late" not in result
    # Details for progress reports: description and only the notes logged that day
    assert "Root cause and approach" in result
    assert "Contributions in range:** 1 of 2" in result
    assert "2026-10-15 09:30: today's note" in result
    assert bad.startswith("Error:")

    assert "Finished in January" in on_day
    assert "Finished in January" not in today
    assert "**Completed:** 2026-01-15 12:00" in marked


@pytest.mark.asyncio
async def test_rest_times_are_marked_utc(client):
    headers = {"Authorization": "Bearer mock_user_utc"}
    created = await client.post(
        "/api/v1/tasks",
        json={"title": "t", "status": "done", "initial_contribution": "n"},
        headers=headers,
    )
    task = created.json()
    for value in (task["date"], task["created_at"], task["completed_at"]):
        assert value.endswith("Z")
    assert task["contributions"][0]["logged_at"].endswith("Z")

    # Read back from the database, where they're stored without a time zone
    listed = (await client.get("/api/v1/tasks", headers=headers)).json()["items"][0]
    assert listed["created_at"].endswith("Z")
    assert listed["contributions"][0]["logged_at"].endswith("Z")
