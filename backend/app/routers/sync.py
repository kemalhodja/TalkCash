from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.models.user import User
from app.schemas.sync import SyncPullResponse, SyncPushRequest, SyncPushResponse
from app.services.sync.service import SyncService

router = APIRouter(prefix="/sync", tags=["Sync"])
sync_service = SyncService()


@router.post("/push", response_model=SyncPushResponse)
async def sync_push(
    body: SyncPushRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    locale = user_locale(user)
    return await sync_service.push(db, user.id, body.operations, locale)


@router.get("/pull", response_model=SyncPullResponse)
async def sync_pull(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await sync_service.pull(db, user.id)
