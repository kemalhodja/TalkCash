import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.ai_mentor.service import AIMentorService
from app.services.notifications.prefs import allows_notification, allows_push
from app.services.notifications.service import NotificationService
from app.utils.redis_client import get_redis

logger = logging.getLogger(__name__)
ai_service = AIMentorService()
notif_service = NotificationService()


async def daily_budget_alert_scan(db: AsyncSession) -> int:
    """Morning scan: push budget warnings for categories at or above 80% (once per day per category)."""
    month_key = datetime.utcnow().strftime("%Y-%m")
    result = await db.execute(select(User))
    sent = 0
    for user in result.scalars().all():
        locale = user.locale or "tr"
        alerts = await ai_service.check_budget_alerts(db, user.id, locale)
        for alert in alerts:
            if alert["type"] not in ("budget_warning", "budget_exceeded"):
                continue
            dedup_key = f"budget_daily:{user.id}:{alert['category']}:{month_key}"
            try:
                r = await get_redis()
                if await r.get(dedup_key):
                    continue
                await r.set(dedup_key, "1", ex=86400)
            except Exception:
                pass
            ntype = "budget_exceeded" if alert["type"] == "budget_exceeded" else "budget_warning"
            if not allows_notification(user, ntype):
                continue
            await notif_service.create_in_app(
                db, user.id, alert["category"], alert["message"], ntype, {"route": "/budget"},
            )
            if user.push_token and allows_push(user, ntype):
                await notif_service.send_push(
                    user.push_token, alert["category"], alert["message"], {"route": "/budget"},
                )
            sent += 1
    logger.info("Daily budget alerts sent: %d", sent)
    return sent
