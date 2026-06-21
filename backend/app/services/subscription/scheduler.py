"""Backend scheduler for subscription renewal reminders (T-2 days)."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.transaction import Transaction
from app.models.user import User
from app.services.notifications.prefs import allows_notification, allows_push
from app.services.notifications.service import NotificationService

notif_service = NotificationService()


async def scan_subscription_reminders(db: AsyncSession) -> int:
    """Send push/in-app reminders 2 days before next_billing_date."""
    target = datetime.utcnow().date() + timedelta(days=2)
    result = await db.execute(
        select(Transaction, User).join(User, Transaction.user_id == User.id).where(
            Transaction.is_recurring.is_(True),
            Transaction.next_billing_date == target,
        )
    )
    sent = 0
    for tx, user in result.all():
        locale = user.locale or "tr"
        provider = tx.subscription_name or ("Abonelik" if locale == "tr" else "Subscription")
        amount = f"{float(tx.amount):.2f}"
        fname = (user.full_name or "").split()[0] if user.full_name else ""
        name_prefix = f"{fname}, " if fname else ""
        title = t("subscription.reminder_title", locale, provider=provider)
        body = t(
            "subscription.reminder_body",
            locale,
            name=name_prefix,
            provider=provider,
            amount=amount,
        )
        meta = {"route": "/transactions", "subscription_name": provider, "transaction_id": str(tx.id)}
        if not allows_notification(user, "agenda_reminder"):
            continue
        await notif_service.create_in_app(db, user.id, title, body, "subscription_reminder", meta)
        if user.push_token and allows_push(user, "agenda_reminder"):
            await notif_service.send_push(user.push_token, title, body, meta)
        sent += 1
    return sent
