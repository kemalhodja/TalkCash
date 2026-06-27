from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime
from decimal import Decimal

from app.models.user import User
from app.services.ai_mentor.service import AIMentorService
from app.services.budget.service import BudgetService
from app.services.notifications.service import NotificationService

ai_service = AIMentorService()
notif_service = NotificationService()
budget_service = BudgetService()


async def push_budget_alerts_after_expense(
    db: AsyncSession, user_id: UUID, category: str, locale: str = "tr",
) -> int:
    """Send push + in-app notification when a category crosses 80% or 100% budget after an expense."""
    user = await db.get(User, user_id)
    if not user:
        return 0

    alerts = await ai_service.check_budget_alerts(db, user_id, locale)
    sent = 0
    for alert in alerts:
        if alert["category"].lower() != (category or "Genel").lower():
            continue
        ntype = "budget_exceeded" if alert["type"] == "budget_exceeded" else "budget_warning"
        if alert["type"] == "budget_exceeded":
            now = datetime.utcnow()
            await budget_service.record_overrun(
                db, user_id, alert["category"],
                Decimal(str(alert.get("limit", 0))),
                Decimal(str(alert.get("spent", 0))),
                now.month, now.year,
            )
        await notif_service.create_in_app(
            db, user_id, alert["category"], alert["message"], ntype, {"route": "/budget"},
        )
        if user.push_token:
            await notif_service.send_push(
                user.push_token, alert["category"], alert["message"], {"url": "talkcash://budget"},
            )
        sent += 1
    return sent
