"""Detect and track recurring subscription payments."""

import re
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.transaction import Transaction
from app.services.agenda.service import AgendaService

SUBSCRIPTION_PATTERNS: list[tuple[str, str]] = [
    (r"netflix", "Netflix"),
    (r"spotify", "Spotify"),
    (r"youtube\s*premium|youtube premium", "YouTube Premium"),
    (r"icloud|apple\s*one", "iCloud"),
    (r"disney\+|disney plus", "Disney+"),
    (r"amazon\s*prime|prime video", "Amazon Prime"),
    (r"exxen", "Exxen"),
    (r"blutv|blu tv", "BluTV"),
    (r"gain", "Gain"),
    (r"microsoft\s*365|office\s*365", "Microsoft 365"),
    (r"adobe|creative cloud", "Adobe"),
    (r"playstation\s*plus|ps\s*plus", "PlayStation Plus"),
    (r"xbox\s*game\s*pass", "Xbox Game Pass"),
    (r"chatgpt|openai\s*plus", "ChatGPT Plus"),
    (r"spor\s*salon|gym|fitness", "Spor Salonu"),
    (r"abonelik|subscription|üyelik|uyelik", "Abonelik"),
]

SUBSCRIPTION_CANCEL_URLS: dict[str, str] = {
    "Netflix": "https://www.netflix.com/cancelplan",
    "Spotify": "https://www.spotify.com/account/subscription/",
    "YouTube Premium": "https://www.youtube.com/paid_memberships",
    "iCloud": "https://appleid.apple.com/account/manage",
    "Disney+": "https://www.disneyplus.com/account",
    "Amazon Prime": "https://www.amazon.com.tr/gp/primecentral",
    "Exxen": "https://www.exxen.com/tr/account",
    "BluTV": "https://www.blutv.com/hesabim",
}


def subscription_cancel_url(provider: str) -> str | None:
    return SUBSCRIPTION_CANCEL_URLS.get(provider)


def detect_subscription(text: str) -> tuple[bool, str | None]:
    lower = text.lower()
    for pattern, label in SUBSCRIPTION_PATTERNS:
        if re.search(pattern, lower):
            return True, label
    if any(w in lower for w in ("aylık", "aylik", "her ay", "monthly")):
        return True, "Abonelik"
    return False, None


class SubscriptionManager:
    def __init__(self):
        self.agenda = AgendaService()

    async def attach_to_transaction(
        self,
        db: AsyncSession,
        user_id: UUID,
        tx: Transaction,
        amount: Decimal,
        provider: str,
        locale: str = "tr",
    ) -> dict:
        next_due = datetime.utcnow() + relativedelta(months=1)
        tx.is_recurring = True
        tx.subscription_name = provider[:255]
        tx.next_billing_date = next_due.date()
        await db.commit()
        await db.refresh(tx)

        title = f"{provider} Abonelik" if locale == "tr" else f"{provider} Subscription"
        item = await self.agenda.add_bill(
            db, user_id, title, amount, next_due, is_recurring=True, force=True,
        )

        remind_at = next_due - timedelta(days=2)
        fname = await self._first_name(db, user_id)
        name_prefix = f"{fname}, " if fname else ""
        speech = t(
            "subscription.reminder_speech",
            locale,
            name=name_prefix,
            provider=provider,
            amount=f"{float(amount):.2f}",
            days="2",
        )

        return {
            "subscription_detected": True,
            "subscription_name": provider,
            "next_billing_date": next_due.date().isoformat(),
            "agenda_id": str(item.id),
            "reminder_at": remind_at.isoformat(),
            "speech_text": speech,
            "cancel_url": subscription_cancel_url(provider),
        }

    async def _first_name(self, db: AsyncSession, user_id: UUID) -> str:
        from app.models.user import User
        user = await db.get(User, user_id)
        if not user or not user.full_name:
            return ""
        return user.full_name.split()[0]
