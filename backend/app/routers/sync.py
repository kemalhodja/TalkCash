from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.models.user import User
from app.schemas.sync import SyncPullResponse, SyncPushRequest, SyncPushResponse
from app.services.sync.service import SyncService
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/sync", tags=["Sync"])
sync_service = SyncService()


@router.post("/push", response_model=SyncPushResponse)
async def sync_push(
    body: SyncPushRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, "sync", settings.sync_rate_limit, identifier=str(user.id))
    locale = user_locale(user)
    return await sync_service.push(db, user.id, body.operations, locale)


@router.get("/pull", response_model=SyncPullResponse)
async def sync_pull(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await sync_service.pull(db, user.id)
