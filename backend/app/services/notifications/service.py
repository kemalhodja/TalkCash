import json
from datetime import datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.agenda import AgendaItem, AgendaStatus
from app.models.notification import Notification
from app.models.user import User

ROUTE_BY_TYPE = {
    "agenda_reminder": "/agenda",
    "budget_warning": "/budget",
    "budget_exceeded": "/budget",
    "price_change": "/",
}


class NotificationService:
    def _route_for(self, ntype: str, metadata: dict | None = None) -> str:
        if metadata and metadata.get("route"):
            return str(metadata["route"])
        return ROUTE_BY_TYPE.get(ntype, "/notifications")

    def _build_metadata(self, ntype: str, extra: dict | None = None) -> str:
        meta = {"route": self._route_for(ntype, extra)}
        if extra:
            meta.update({k: v for k, v in extra.items() if k != "route"})
        return json.dumps(meta)

    async def register_push_token(self, db: AsyncSession, user_id: UUID, token: str) -> None:
        user = await db.get(User, user_id)
        if user:
            user.push_token = token
            await db.commit()

    async def send_push(
        self, push_token: str, title: str, body: str, data: dict | None = None,
    ) -> bool:
        payload: dict = {"to": push_token, "title": title, "body": body, "sound": "default"}
        if data:
            payload["data"] = data
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post("https://exp.host/--/api/v2/push/send", json=payload)
            return True
        except Exception:
            return False

    async def create_in_app(
        self, db: AsyncSession, user_id: UUID, title: str, body: str, ntype: str,
        metadata: dict | None = None,
    ) -> Notification:
        meta_json = self._build_metadata(ntype, metadata)
        notif = Notification(
            user_id=user_id, title=title, body=body,
            notification_type=ntype, metadata_json=meta_json,
        )
        db.add(notif)
        await db.commit()
        await db.refresh(notif)
        return notif

    async def check_agenda_reminders(self, db: AsyncSession, when: str = "today") -> int:
        """when: 'today' for due-date morning reminders, 'tomorrow' for day-before evening reminders."""
        result = await db.execute(
            select(AgendaItem, User).join(User, AgendaItem.user_id == User.id).where(
                AgendaItem.status.in_([AgendaStatus.PENDING, AgendaStatus.OVERDUE]),
            )
        )
        sent = 0
        for item, user in result.all():
            tz = ZoneInfo(user.timezone or "Europe/Istanbul")
            now_local = datetime.now(tz)
            target = now_local.date() if when == "today" else now_local.date() + timedelta(days=1)
            due = item.due_date.replace(tzinfo=None) if item.due_date.tzinfo else item.due_date
            if due.date() != target:
                continue
            locale = user.locale or "tr"
            if when == "tomorrow":
                title = t("notif.agenda_tomorrow_title", locale, title=item.title)
                body = t("notif.agenda_tomorrow_body", locale, amount=item.amount)
            else:
                title = t("notif.agenda_today_title", locale, title=item.title)
                body = t("notif.agenda_today_body", locale, amount=item.amount)

            meta = {"route": "/agenda", "agenda_id": str(item.id)}
            await self.create_in_app(db, user.id, title, body, "agenda_reminder", meta)
            if user.push_token:
                await self.send_push(user.push_token, title, body, {"url": "talkcash://agenda"})
            sent += 1
        return sent

    async def list_notifications(self, db: AsyncSession, user_id: UUID) -> list[Notification]:
        result = await db.execute(
            select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())
        )
        return list(result.scalars().all())

    async def mark_read(self, db: AsyncSession, user_id: UUID, notification_id: UUID) -> Notification:
        notif = await db.get(Notification, notification_id)
        if not notif or notif.user_id != user_id:
            raise ValueError("not_found")
        notif.is_read = True
        await db.commit()
        return notif

    async def mark_all_read(self, db: AsyncSession, user_id: UUID) -> int:
        result = await db.execute(
            select(Notification).where(Notification.user_id == user_id, Notification.is_read == False)
        )
        count = 0
        for notif in result.scalars().all():
            notif.is_read = True
            count += 1
        if count:
            await db.commit()
        return count
