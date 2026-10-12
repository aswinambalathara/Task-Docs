"""
User time zone helpers (IANA names such as "Asia/Kolkata").
Requires the `tzdata` package on systems without a time zone database (e.g. Windows).
"""

from datetime import UTC, datetime
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
