"""
Which tasks an AI summary is about, and whether a cached summary is still current.

A weekly summary covers one Monday-to-Sunday calendar week inside a month (weeks are cut
at month boundaries) and a monthly dossier covers one calendar month, both in the user's
time zone. The sync, the preview endpoint and the stale-summary refresh all use these
helpers, so a preview is written about exactly the tasks the synced summary covers.

Each cached summary stores a fingerprint of the task IDs it was written about. When tasks
are added to or removed from that period, the fingerprint no longer matches and the
summary is stale.
"""

import calendar
import hashlib
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from app.models.integration import SummaryMeta
from app.models.task import Task


def month_calendar_weeks(year: int, month: int) -> list[dict[str, Any]]:
    """
    Partitions any month into Monday-to-Sunday calendar weeks matching the exact
    date boundary convention seen in Tethr_Task_Documentation_January_2026.docx.
    """
    _, last_day = calendar.monthrange(year, month)
    weeks = []
    current_start = date(year, month, 1)
    week_num = 1
    while current_start.month == month:
        days_until_sunday = 6 - current_start.weekday()
        current_end = current_start + timedelta(days=days_until_sunday)
        if current_end.month != month:
            current_end = date(year, month, last_day)
        weeks.append(
            {
                "week_num": week_num,
                "start_date": current_start,
                "end_date": current_end,
                "start_str": current_start.strftime("%d/%m/%Y"),
                "end_str": current_end.strftime("%d/%m/%Y"),
            }
        )
        week_num += 1
        current_start = current_end + timedelta(days=1)
    return weeks


def weekly_key(year: int, month: int, week_num: int) -> str:
    return f"weekly:{year}:{month}:{week_num}"


def monthly_key(year: int, month: int) -> str:
    return f"monthly:{year}:{month}"


@dataclass(frozen=True)
class TargetPeriod:
    """The week and month that new summaries are written for."""

    year: int
    month: int
    week_num: int
    week_start: date
    week_end: date

    @property
    def weekly_key(self) -> str:
        return weekly_key(self.year, self.month, self.week_num)

    @property
    def monthly_key(self) -> str:
        return monthly_key(self.year, self.month)


def target_period(local_tasks: list[Task], now_local: datetime) -> TargetPeriod:
    """
    The current week and month, or, when nothing was logged this month, the week and
    month of the latest task (so a sync after a quiet month still summarizes real work).
    `local_tasks` must already be converted to the user's time zone.
    """
    today = now_local.date()
    latest = max((t.date for t in local_tasks), default=now_local).date()
    anchor = today if (latest.year, latest.month) == (today.year, today.month) else latest

    weeks = month_calendar_weeks(anchor.year, anchor.month)
    week = next((w for w in weeks if w["start_date"] <= anchor <= w["end_date"]), weeks[-1])
    return TargetPeriod(
        year=anchor.year,
        month=anchor.month,
        week_num=week["week_num"],
        week_start=week["start_date"],
        week_end=week["end_date"],
    )


def week_tasks(local_tasks: list[Task], period: TargetPeriod) -> list[Task]:
    return [t for t in local_tasks if period.week_start <= t.date.date() <= period.week_end]


def month_tasks(local_tasks: list[Task], period: TargetPeriod) -> list[Task]:
    return [t for t in local_tasks if (t.date.year, t.date.month) == (period.year, period.month)]


def tasks_for_key(local_tasks: list[Task], key: str) -> list[Task] | None:
    """Tasks in the period a cache key names, or None if the key is not a period key."""
    parts = key.split(":")
    try:
        if parts[0] == "weekly" and len(parts) == 4:
            year, month, week_num = int(parts[1]), int(parts[2]), int(parts[3])
            week = next(
                (w for w in month_calendar_weeks(year, month) if w["week_num"] == week_num), None
            )
            if week is None:
                return None
            return [
                t for t in local_tasks if week["start_date"] <= t.date.date() <= week["end_date"]
            ]
        if parts[0] == "monthly" and len(parts) == 3:
            year, month = int(parts[1]), int(parts[2])
            return [t for t in local_tasks if (t.date.year, t.date.month) == (year, month)]
    except ValueError:
        return None
    return None


def fingerprint(tasks: list[Task]) -> str:
    """Identifies a set of tasks independent of order; changes when tasks are added or removed."""
    ids = sorted(str(t.id) for t in tasks)
    return hashlib.sha256(",".join(ids).encode()).hexdigest()[:32]


def summary_state(
    summary_meta: dict[str, SummaryMeta], has_summary: bool, local_tasks: list[Task], key: str
) -> dict[str, Any]:
    """Whether the summary for `key` exists and still matches the tasks in its period."""
    current = tasks_for_key(local_tasks, key) or []
    meta = summary_meta.get(key)
    return {
        "key": key,
        "generated": has_summary,
        # Summaries cached before fingerprints existed cannot be checked, so they count as current
        "stale": bool(has_summary and meta and meta.fingerprint != fingerprint(current)),
        "summarized_task_count": meta.task_count if meta else None,
        "current_task_count": len(current),
        "generated_at": meta.generated_at if meta else None,
    }


def stale_summary_keys(
    cached_summaries: dict[str, str], summary_meta: dict[str, SummaryMeta], local_tasks: list[Task]
) -> list[str]:
    """Cached summaries whose period's tasks changed since they were written, newest first."""
    stale = []
    for key, meta in summary_meta.items():
        if key not in cached_summaries:
            continue
        current = tasks_for_key(local_tasks, key)
        if current is not None and meta.fingerprint != fingerprint(current):
            stale.append(key)

    def sort_key(k: str) -> tuple[int, int, int]:
        parts = [int(p) for p in k.split(":")[1:]]
        # A month's dossier sorts after its weeks
        return (parts[0], parts[1], parts[2] if len(parts) == 3 else 99)

    return sorted(stale, key=sort_key, reverse=True)
