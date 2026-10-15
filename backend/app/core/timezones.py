"""
User time zone helpers (IANA names such as "Asia/Kolkata").
Requires the `tzdata` package on systems without a time zone database (e.g. Windows).
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def is_valid_timezone(name: str) -> bool:
    try:
        ZoneInfo(name)
        return True
    except (ZoneInfoNotFoundError, ValueError):
        return False


def get_zone(name: str | None) -> ZoneInfo:
    """Returns the user's zone, falling back to UTC for missing or unknown names."""
    if name and is_valid_timezone(name):
        return ZoneInfo(name)
    return ZoneInfo("UTC")


def to_local(dt: datetime, zone: ZoneInfo) -> datetime:
    """Converts a stored datetime to the user's zone (MongoDB returns naive UTC values)."""
    aware = dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    return aware.astimezone(zone)


def parse_local_day(value: str, zone: ZoneInfo) -> date:
    """Parses "today", "yesterday" or YYYY-MM-DD as a calendar day in the user's zone."""
    key = value.strip().lower()
    today = datetime.now(zone).date()
    if key == "today":
        return today
    if key == "yesterday":
        return today - timedelta(days=1)
    try:
        return date.fromisoformat(key)
    except ValueError:
        raise ValueError(
            f'Invalid date "{value}": use YYYY-MM-DD, "today" or "yesterday".'
        ) from None


def day_timestamp(value: str, zone: ZoneInfo) -> datetime | None:
    """
    A timestamp for a day given as YYYY-MM-DD, "today" or "yesterday": None for today (use now),
    else local noon in UTC, which keeps the same calendar date in UTC for zones within ±12h.
    """
    day = parse_local_day(value, zone)
    if day == datetime.now(zone).date():
        return None
    return datetime.combine(day, time(12), zone).astimezone(UTC)


def local_day_range(
    date_from: str | None, date_to: str | None, zone: ZoneInfo
) -> tuple[datetime | None, datetime | None]:
    """
    Naive UTC bounds [start, end) covering whole local days from date_from through date_to.
    Either side may be left open.
    """
    if not date_from and not date_to:
        return None, None
    first = parse_local_day(date_from, zone) if date_from else None
    last = parse_local_day(date_to, zone) if date_to else None
    if first and last and first > last:
        raise ValueError(f"date_from ({first}) is after date_to ({last}).")

    def to_utc(day: date) -> datetime:
        return datetime.combine(day, time.min, zone).astimezone(UTC).replace(tzinfo=None)

    start = to_utc(first) if first else None
    end = to_utc(last + timedelta(days=1)) if last else None
    return start, end
