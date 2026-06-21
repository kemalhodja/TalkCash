from uuid import UUID

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.notification import NotificationPrefsResponse, NotificationPrefsUpdate
from app.services.notifications.prefs import parse_prefs, serialize_prefs
from app.services.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])
notif_service = NotificationService()


def _to_response(user: User) -> NotificationPrefsResponse:
    prefs = parse_prefs(user.notification_prefs)
    return NotificationPrefsResponse(**prefs)


@router.get("/preferences", response_model=NotificationPrefsResponse)
async def get_notification_preferences(user: User = Depends(get_current_user)):
    return _to_response(user)


@router.patch("/preferences", response_model=NotificationPrefsResponse)
async def update_notification_preferences(
    body: NotificationPrefsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prefs = parse_prefs(user.notification_prefs)
    for key, value in body.model_dump(exclude_unset=True).items():
        prefs[key] = value
    user.notification_prefs = serialize_prefs(prefs)
    await db.commit()
    await db.refresh(user)
    return _to_response(user)


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
            "metadata": json.loads(n.metadata_json) if n.metadata_json else {},
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
