from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.ai_mentor.service import AIMentorService

router = APIRouter(prefix="/ai", tags=["AI Mentor"])
ai_service = AIMentorService()


@router.get("/budget-alerts")
async def budget_alerts(user_id: UUID, db: AsyncSession = Depends(get_db)):
    return await ai_service.check_budget_alerts(db, user_id)


@router.get("/forecast")
async def month_end_forecast(user_id: UUID, current_balance: float, db: AsyncSession = Depends(get_db)):
    return await ai_service.predict_month_end(db, user_id, Decimal(str(current_balance)))


@router.get("/price-tracker")
async def price_tracker(user_id: UUID, product: str, db: AsyncSession = Depends(get_db)):
    report = await ai_service.price_change_report(db, user_id, product)
    return report or {"message": "Yeterli veri bulunamadı."}
