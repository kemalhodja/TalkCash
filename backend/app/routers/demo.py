from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error
from app.models.user import User
from app.services.demo.service import seed_demo_data

router = APIRouter(prefix="/demo", tags=["Demo"])


@router.post("/seed")
async def seed_sample_data(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await seed_demo_data(db, user.id, user_locale(user))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=resolve_error(exc, user_locale(user)))
