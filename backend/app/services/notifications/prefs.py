import json
from datetime import datetime, time
from zoneinfo import ZoneInfo

from app.models.user import User

DEFAULT_NOTIFICATION_PREFS: dict = {
    "agenda_reminder": True,
    "budget_warning": True,
    "budget_exceeded": True,
    "price_change": True,
    "premium_expiry_reminder": True,
    "premium_grace": True,
    "premium_expired": True,
    "retention_evening_nudge": True,
    "retention_weekly_summary": True,
    "retention_persona_nudge": True,
    "retention_paywall_recovery": True,
    "quiet_hours_enabled": False,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "08:00",
}


def parse_prefs(raw: str | None) -> dict:
    if not raw:
        return dict(DEFAULT_NOTIFICATION_PREFS)
    try:
        stored = json.loads(raw)
        if not isinstance(stored, dict):
            return dict(DEFAULT_NOTIFICATION_PREFS)
        return {**DEFAULT_NOTIFICATION_PREFS, **stored}
    except json.JSONDecodeError:
        return dict(DEFAULT_NOTIFICATION_PREFS)


def serialize_prefs(prefs: dict) -> str:
    merged = {**DEFAULT_NOTIFICATION_PREFS, **prefs}
    return json.dumps(merged)


def _parse_hhmm(value: str) -> time:
    hour, minute = value.split(":", 1)
    return time(hour=int(hour), minute=int(minute))


def is_quiet_hours(user: User) -> bool:
    prefs = parse_prefs(user.notification_prefs)
    if not prefs.get("quiet_hours_enabled"):
        return False
    try:
        start = _parse_hhmm(str(prefs["quiet_hours_start"]))
        end = _parse_hhmm(str(prefs["quiet_hours_end"]))
    except (ValueError, TypeError):
        return False

    tz = ZoneInfo(user.timezone or "Europe/Istanbul")
    now = datetime.now(tz).time()
    if start <= end:
        return start <= now < end
    return now >= start or now < end


def allows_notification(user: User, ntype: str) -> bool:
    prefs = parse_prefs(user.notification_prefs)
    key = ntype if ntype in DEFAULT_NOTIFICATION_PREFS else None
    if not key:
        return True
    return bool(prefs.get(key, True))


def allows_push(user: User, ntype: str) -> bool:
    return allows_notification(user, ntype) and not is_quiet_hours(user)
