"""Retention push notifications — evening nudge, weekly report, persona nudges, paywall recovery."""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.analytics import ProductEvent
from app.models.budget import BudgetLimit
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.services.billing.service import BillingService
from app.services.notifications.prefs import allows_notification, allows_push
from app.services.notifications.service import NotificationService
from app.utils.redis_client import get_redis

logger = logging.getLogger(__name__)
notif_service = NotificationService()

FOOD_CATEGORY_HINTS = (
    "yemek", "food", "kahve", "coffee", "restaurant", "restoran", "market",
    "yeme", "dining", "cafe", "kafe", "delivery", "sipariş", "siparis",
)
WEEKLY_FOOD_MIN_PCT = 35.0
PAYWALL_RECOVERY_HOURS = 24


async def _dedup(key: str, ttl: int) -> bool:
    """Return True if already sent (skip)."""
    try:
        redis = await get_redis()
        if await redis.get(key):
            return True
        await redis.set(key, "1", ex=ttl)
        return False
    except Exception:
        return False


async def _notify(
    db: AsyncSession,
    user: User,
    title: str,
    body: str,
    ntype: str,
    route: str,
) -> None:
    meta = {"route": route, "type": ntype}
    if allows_notification(user, ntype):
        await notif_service.create_in_app(db, user.id, title, body, ntype, meta)
    if user.push_token and allows_push(user, ntype):
        await notif_service.send_push(user.push_token, title, body, meta)


def _user_local_now(user: User) -> datetime:
    tz = ZoneInfo(user.timezone or "Europe/Istanbul")
    return datetime.now(tz)


async def _user_local_date(user: User):
    return _user_local_now(user).date()


async def _had_expense_on_date(db: AsyncSession, user_id, day) -> bool:
    start = datetime.combine(day, datetime.min.time())
    end = start + timedelta(days=1)
    result = await db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == TransactionType.EXPENSE,
            Transaction.created_at >= start,
            Transaction.created_at < end,
        )
    )
    return int(result.scalar() or 0) > 0


async def scan_evening_expense_nudge(db: AsyncSession) -> int:
    """
    21:30 local: nudge users who logged no expense today.
    "Bugün cüzdanından ne çıktı?"
    """
    result = await db.execute(select(User))
    sent = 0
    for user in result.scalars().all():
        now = _user_local_now(user)
        if now.hour != 21 or now.minute != 30:
            continue
        today = now.date()
        if await _had_expense_on_date(db, user.id, today):
            continue
        dedup_key = f"retention:evening:{user.id}:{today.isoformat()}"
        if await _dedup(dedup_key, 86400):
            continue
        locale = user.locale or "tr"
        title = t("notif.retention_evening_title", locale)
        body = t("notif.retention_evening_body", locale)
        await _notify(db, user, title, body, "retention_evening_nudge", "/input")
        sent += 1
    await db.commit()
    return sent


async def _weekly_category_breakdown(
    db: AsyncSession, user_id: UUID, week_start: datetime, week_end: datetime,
) -> list[tuple[str, Decimal]]:
    result = await db.execute(
        select(Transaction.category, func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == TransactionType.EXPENSE,
            Transaction.created_at >= week_start,
            Transaction.created_at < week_end,
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )
    return [(cat or "Genel", Decimal(str(total or 0))) for cat, total in result.all()]


def _is_food_category(category: str) -> bool:
    lowered = category.lower()
    return any(h in lowered for h in FOOD_CATEGORY_HINTS)


def _food_spend_pct(breakdown: list[tuple[str, Decimal]]) -> float:
    total = sum(amount for _, amount in breakdown)
    if total <= 0:
        return 0.0
    food_total = sum(amount for cat, amount in breakdown if _is_food_category(cat))
    return float(food_total / total * 100)


async def scan_weekly_finance_report(db: AsyncSession) -> int:
    """
    Sunday 12:00 local: invite users to weekly AI insights.
    "Haftalık Finans Raporun Hazır!"
    """
    result = await db.execute(select(User))
    sent = 0
    for user in result.scalars().all():
        now = _user_local_now(user)
        if now.weekday() != 6 or now.hour != 12 or now.minute != 0:
            continue

        today = now.date()
        week_end = datetime.combine(today + timedelta(days=1), datetime.min.time())
        week_start = week_end - timedelta(days=7)
        breakdown = await _weekly_category_breakdown(db, user.id, week_start, week_end)
        if not breakdown:
            continue

        dedup_key = f"retention:weekly_report:{user.id}:{today.isocalendar()[1]}"
        if await _dedup(dedup_key, 86400 * 8):
            continue

        locale = user.locale or "tr"
        title = t("notif.retention_weekly_title", locale)
        body = t("notif.retention_weekly_body", locale)
        await _notify(db, user, title, body, "retention_weekly_summary", "/insights")
        sent += 1

    await db.commit()
    return sent


async def _has_budget_overrun(db: AsyncSession, user_id: UUID) -> bool:
    now = datetime.utcnow()
    month, year = now.month, now.year
    budgets = await db.execute(select(BudgetLimit).where(BudgetLimit.user_id == user_id))
    for budget in budgets.scalars().all():
        start = datetime(year, month, 1)
        end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
        spent_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.category == budget.category,
                Transaction.transaction_type == TransactionType.EXPENSE,
                Transaction.created_at >= start,
                Transaction.created_at < end,
            )
        )
        spent = Decimal(str(spent_result.scalar() or 0))
        if budget.monthly_limit > 0 and spent > budget.monthly_limit:
            return True
    return False


async def scan_persona_weekly_nudge(db: AsyncSession) -> int:
    """
    Wednesday 19:00 local: persona-specific weekly nudge (angry_mom / wall_street).
    """
    result = await db.execute(select(User))
    sent = 0
    for user in result.scalars().all():
        persona = (user.assistant_persona or "default").strip().lower()
        if persona not in ("angry_mom", "wall_street"):
            continue

        now = _user_local_now(user)
        if now.weekday() != 2 or now.hour != 19 or now.minute != 0:
            continue

        today = now.date()
        week_end = datetime.combine(today + timedelta(days=1), datetime.min.time())
        week_start = week_end - timedelta(days=7)
        breakdown = await _weekly_category_breakdown(db, user.id, week_start, week_end)
        if not breakdown:
            continue

        if persona == "angry_mom":
            food_pct = _food_spend_pct(breakdown)
            if food_pct < WEEKLY_FOOD_MIN_PCT:
                continue
            ntype = "retention_persona_nudge"
            dedup_key = f"retention:persona:angry_mom:{user.id}:{today.isocalendar()[1]}"
            locale = user.locale or "tr"
            title = t("notif.retention_persona_angry_mom_title", locale)
            body = t("notif.retention_persona_angry_mom_body", locale)
            route = "/input"
        else:
            if not await _has_budget_overrun(db, user.id):
                continue
            ntype = "retention_persona_nudge"
            dedup_key = f"retention:persona:wall_street:{user.id}:{today.isocalendar()[1]}"
            locale = user.locale or "tr"
            title = t("notif.retention_persona_wall_street_title", locale)
            body = t("notif.retention_persona_wall_street_body", locale)
            route = "/insights"

        if await _dedup(dedup_key, 86400 * 8):
            continue
        await _notify(db, user, title, body, ntype, route)
        sent += 1

    await db.commit()
    return sent


async def _user_still_free(db: AsyncSession, user_id: UUID) -> bool:
    billing = BillingService()
    if billing.premium_unlocked():
        return False
    return not await billing.is_user_premium(db, user_id)


async def scan_paywall_recovery(db: AsyncSession) -> int:
    """
    24h after paywall_viewed or entitlement_limit_hit — premium discount recovery push.
    """
    window_end = datetime.utcnow() - timedelta(hours=PAYWALL_RECOVERY_HOURS)
    window_start = window_end - timedelta(hours=1)

    result = await db.execute(
        select(ProductEvent.user_id)
        .where(
            ProductEvent.user_id.isnot(None),
            ProductEvent.event_name.in_(("paywall_viewed", "entitlement_limit_hit")),
            ProductEvent.created_at >= window_start,
            ProductEvent.created_at < window_end,
        )
        .group_by(ProductEvent.user_id)
    )
    user_ids = [row[0] for row in result.all() if row[0]]
    if not user_ids:
        return 0

    sent = 0
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    for user in users_result.scalars().all():
        if not await _user_still_free(db, user.id):
            continue

        upgraded = await db.execute(
            select(func.count(ProductEvent.id)).where(
                ProductEvent.user_id == user.id,
                ProductEvent.event_name == "premium_upgrade_tapped",
                ProductEvent.created_at >= window_start,
            )
        )
        if int(upgraded.scalar() or 0) > 0:
            continue

        dedup_key = f"retention:paywall_recovery:{user.id}:{window_end.date().isoformat()}"
        if await _dedup(dedup_key, 86400 * 14):
            continue

        locale = user.locale or "tr"
        title = t("notif.retention_paywall_title", locale)
        body = t("notif.retention_paywall_body", locale)
        await _notify(db, user, title, body, "retention_paywall_recovery", "/settings")
        sent += 1

    await db.commit()
    return sent


# Backward-compatible alias used in older imports/tests
async def scan_weekend_spending_summary(db: AsyncSession) -> int:
    return await scan_weekly_finance_report(db)
