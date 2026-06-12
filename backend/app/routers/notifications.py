from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])
notif_service = NotificationService()


@router.post("/register-token")
async def register_token(token: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await notif_service.register_push_token(db, user.id, token)
    return {"status": "ok"}


@router.get("/")
async def list_notifications(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await notif_service.list_notifications(db, user.id)
    return [
        {
            "id": str(n.id), "title": n.title, "body": n.body,
            "type": n.notification_type, "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in items
    ]


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        notif = await notif_service.mark_read(db, user.id, notification_id)
        return {"id": str(notif.id), "is_read": notif.is_read}
    except ValueError:
        raise HTTPException(status_code=404, detail="Notification not found")


@router.post("/read-all")
async def mark_all_read(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = await notif_service.mark_all_read(db, user.id)
    return {"marked": count}
