from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import t
from app.models.user import User
from app.services.ai_mentor.service import AIMentorService

router = APIRouter(prefix="/ai", tags=["AI Mentor"])
ai_service = AIMentorService()


@router.get("/budget-alerts")
async def budget_alerts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await ai_service.check_budget_alerts(db, user.id, user_locale(user))


@router.get("/forecast")
async def month_end_forecast(current_balance: float, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await ai_service.predict_month_end(db, user.id, Decimal(str(current_balance)), user_locale(user))


@router.get("/price-tracker")
async def price_tracker(product: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    locale = user_locale(user)
    report = await ai_service.price_change_report(db, user.id, product, locale)
    return report or {"message": t("ai.insufficient_data", locale)}
