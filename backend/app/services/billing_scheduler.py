import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.i18n import t
from app.models.billing import PlanTier, Subscription, SubscriptionStatus
from app.models.user import User
from app.services.billing.service import BillingService
from app.services.notifications.prefs import allows_notification, allows_push
from app.services.notifications.service import NotificationService
from app.utils.redis_client import get_redis

logger = logging.getLogger(__name__)
billing_service = BillingService()
notif_service = NotificationService()

REMINDER_DAYS = (3, 1, 0)
_PREMIUM_ROUTE = "/settings"


async def _dedup(key: str, ttl: int) -> bool:
    """Return True if notification was already sent (skip)."""
    try:
        redis = await get_redis()
        if await redis.get(key):
            return True
        await redis.set(key, "1", ex=ttl)
        return False
    except Exception:
        return False


async def _notify_user(
    db: AsyncSession,
    user: User,
    title: str,
    body: str,
    ntype: str,
) -> None:
    if not allows_notification(user, ntype):
        return
    meta = {"route": _PREMIUM_ROUTE}
    await notif_service.create_in_app(db, user.id, title, body, ntype, meta)
    if user.push_token and allows_push(user, ntype):
        await notif_service.send_push(user.push_token, title, body, meta)


async def notify_subscription_grace_period(db: AsyncSession, user_id) -> bool:
    """Send grace-period warning once per day (also callable from RTDN webhook)."""
    result = await db.execute(
        select(Subscription, User)
        .join(User, Subscription.user_id == User.id)
        .options(selectinload(Subscription.plan))
        .where(Subscription.user_id == user_id)
    )
    row = result.first()
    if not row:
        return False
    subscription, user = row
    if subscription.status != SubscriptionStatus.GRACE_PERIOD:
        return False
    plan = subscription.plan
    if not plan or plan.key == PlanTier.FREE:
        return False

    expire = subscription.expire_date
    expire_key = expire.date().isoformat() if expire else "unknown"
    dedup_key = f"premium_grace:{user.id}:{expire_key}"
    if await _dedup(dedup_key, 86400):
        return False

    locale = user.locale or "tr"
    expire_label = expire.strftime("%d.%m.%Y") if expire else "—"
    title = t("notif.premium_grace_title", locale, plan=plan.name)
    body = t("notif.premium_grace_body", locale, date=expire_label)
    await _notify_user(db, user, title, body, "premium_grace")
    return True


async def daily_premium_subscription_scan(db: AsyncSession) -> int:
    """Expire due subscriptions and send renewal reminders (3d / 1d / today / grace)."""
    now = datetime.utcnow()
    result = await db.execute(
        select(Subscription, User)
        .join(User, Subscription.user_id == User.id)
        .options(selectinload(Subscription.plan))
        .where(
            Subscription.expire_date.isnot(None),
            Subscription.status.in_(
                (
                    SubscriptionStatus.ACTIVE,
                    SubscriptionStatus.TRIALING,
                    SubscriptionStatus.GRACE_PERIOD,
                )
            ),
        )
    )
    sent = 0
    for subscription, user in result.all():
        plan = subscription.plan
        if not plan or plan.key == PlanTier.FREE:
            continue

        locale = user.locale or "tr"
        plan_name = plan.name
        expire = subscription.expire_date
        if expire and expire.tzinfo:
            expire = expire.replace(tzinfo=None)

        if expire and expire <= now:
            was_premium = subscription.is_premium
            await billing_service._expire_subscription(db, subscription)
            if was_premium:
                dedup_key = f"premium_expired:{user.id}:{expire.date().isoformat()}"
                if not await _dedup(dedup_key, 86400 * 7):
                    title = t("notif.premium_expired_title", locale, plan=plan_name)
                    body = t("notif.premium_expired_body", locale)
                    await _notify_user(db, user, title, body, "premium_expired")
                    sent += 1
            continue

        if subscription.status == SubscriptionStatus.GRACE_PERIOD:
            if await notify_subscription_grace_period(db, user.id):
                sent += 1
            continue

        if not expire:
            continue

        days_left = (expire.date() - now.date()).days
        if days_left not in REMINDER_DAYS:
            continue

        dedup_key = f"premium_remind:{user.id}:{days_left}:{expire.date().isoformat()}"
        if await _dedup(dedup_key, 86400 * 2):
            continue

        if days_left == 0:
            title = t("notif.premium_expires_today_title", locale, plan=plan_name)
            body = t("notif.premium_expires_today_body", locale)
        else:
            title = t("notif.premium_expires_soon_title", locale, plan=plan_name)
            body = t("notif.premium_expires_soon_body", locale, days=days_left)
        await _notify_user(db, user, title, body, "premium_expiry_reminder")
        sent += 1

    logger.info("Premium subscription scan: %d notifications", sent)
    return sent
