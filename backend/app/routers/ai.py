from decimal import Decimal

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import t
from app.models.user import User
from app.services.ai_mentor.service import AIMentorService
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/ai", tags=["AI Mentor"])
ai_service = AIMentorService()


@router.get("/budget-alerts")
async def budget_alerts(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, "ai", settings.ai_rate_limit, identifier=str(user.id), strict=True)
    return await ai_service.check_budget_alerts(db, user.id, user_locale(user))


@router.get("/forecast")
async def month_end_forecast(
    request: Request,
    current_balance: float,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, "ai", settings.ai_rate_limit, identifier=str(user.id), strict=True)
    return await ai_service.predict_month_end(db, user.id, Decimal(str(current_balance)), user_locale(user))


@router.get("/price-tracker")
async def price_tracker(
    request: Request,
    product: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, "ai", settings.ai_rate_limit, identifier=str(user.id), strict=True)
    locale = user_locale(user)
    report = await ai_service.price_change_report(db, user.id, product, locale)
    if report:
        return {**report, "has_data": True}
    return {"message": t("ai.insufficient_data", locale), "has_data": False}
