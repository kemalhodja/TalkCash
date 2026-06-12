from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error, t
from app.models.user import User
from app.services.ai_mentor.service import AIMentorService
from app.services.price_watch.service import PriceWatchService
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/ai", tags=["AI Mentor"])
ai_service = AIMentorService()
watch_service = PriceWatchService()


class WatchlistAdd(BaseModel):
    product_name: str
    threshold_percent: float = 5.0


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


@router.get("/watchlist")
async def list_watchlist(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await watch_service.list_items(db, user.id)
    return [
        {
            "id": str(i.id), "product_name": i.product_name,
            "threshold_percent": float(i.threshold_percent),
            "last_avg_price": float(i.last_avg_price) if i.last_avg_price else None,
        }
        for i in items
    ]


@router.post("/watchlist")
async def add_watchlist_item(
    data: WatchlistAdd, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        item = await watch_service.add_item(
            db, user.id, data.product_name, Decimal(str(data.threshold_percent)),
        )
        return {"id": str(item.id), "product_name": item.product_name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))


@router.delete("/watchlist/{item_id}")
async def remove_watchlist_item(
    item_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        await watch_service.remove_item(db, user.id, item_id)
        return {"status": "removed"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))
