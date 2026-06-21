from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError, t
from app.models.social import PriceWatchItem
from app.models.user import User
from app.services.ai_mentor.service import AIMentorService
from app.services.notifications.prefs import allows_notification, allows_push
from app.services.notifications.service import NotificationService

ai_service = AIMentorService()
notif_service = NotificationService()


class PriceWatchService:
    async def list_items(self, db: AsyncSession, user_id: UUID) -> list[PriceWatchItem]:
        result = await db.execute(
            select(PriceWatchItem).where(PriceWatchItem.user_id == user_id)
            .order_by(PriceWatchItem.product_name)
        )
        return list(result.scalars().all())

    async def add_item(
        self, db: AsyncSession, user_id: UUID, product_name: str,
        threshold_percent: Decimal = Decimal("5"),
    ) -> PriceWatchItem:
        name = product_name.strip()
        if not name:
            raise I18nError("ai.product_required")
        existing = await db.execute(
            select(PriceWatchItem).where(
                PriceWatchItem.user_id == user_id,
                PriceWatchItem.product_name.ilike(name),
            )
        )
        if existing.scalars().first():
            raise I18nError("ai.watchlist_duplicate")
        item = PriceWatchItem(
            user_id=user_id, product_name=name,
            threshold_percent=threshold_percent,
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return item

    async def remove_item(self, db: AsyncSession, user_id: UUID, item_id: UUID) -> None:
        item = await db.get(PriceWatchItem, item_id)
        if not item or item.user_id != user_id:
            raise I18nError("ai.watchlist_not_found")
        await db.delete(item)
        await db.commit()

    async def scan_all(self, db: AsyncSession) -> int:
        result = await db.execute(select(PriceWatchItem))
        sent = 0
        for watch in result.scalars().all():
            user = await db.get(User, watch.user_id)
            if not user:
                continue
            locale = user.locale or "tr"
            report = await ai_service.price_change_report(db, watch.user_id, watch.product_name, locale)
            if not report or report.get("change_percent") is None:
                continue
            change = abs(float(report["change_percent"]))
            threshold = float(watch.threshold_percent or 5)
            if change < threshold:
                continue
            direction = "increased" if report["change_percent"] > 0 else "decreased"
            msg = t(f"ai.price_{direction}", locale,
                    product=watch.product_name, percent=int(change))
            await notif_service.create_in_app(
                db, watch.user_id, watch.product_name, msg, "price_change", {"route": "/"},
            )
            if not allows_notification(user, "price_change"):
                continue
            if user.push_token and allows_push(user, "price_change"):
                await notif_service.send_push(
                    user.push_token, watch.product_name, msg, {"route": "/"},
                )
            watch.last_checked_at = datetime.utcnow()
            if report.get("current_avg") is not None:
                watch.last_avg_price = Decimal(str(report["current_avg"]))
            sent += 1
        await db.commit()
        return sent
