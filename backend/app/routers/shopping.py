from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.shopping.service import ShoppingService

router = APIRouter(prefix="/shopping", tags=["Shopping"])
shopping_service = ShoppingService()


@router.get("/")
async def list_items(user_id: UUID, db: AsyncSession = Depends(get_db)):
    items = await shopping_service.list_active(db, user_id)
    grouped: dict[str, list] = {}
    for item in items:
        cat = item.category.value
        grouped.setdefault(cat, []).append({
            "id": str(item.id), "name": item.name,
            "is_routine": item.is_routine,
        })
    return grouped


@router.post("/add")
async def add_items(user_id: UUID, items: list[str], db: AsyncSession = Depends(get_db)):
    created = await shopping_service.add_items(db, user_id, items)
    return {"added": len(created), "items": [i.name for i in created]}


@router.post("/complete/{item_id}")
async def complete_item(
    item_id: UUID, user_id: UUID, price: float | None = None,
    wallet_id: UUID | None = None, db: AsyncSession = Depends(get_db),
):
    try:
        item = await shopping_service.complete_item(
            db, user_id, item_id,
            Decimal(str(price)) if price else None, wallet_id,
        )
        return {"id": str(item.id), "completed": True, "price": float(item.price) if item.price else None}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/daily-reset")
async def daily_reset(db: AsyncSession = Depends(get_db)):
    count = await shopping_service.daily_reset(db)
    return {"cleared": count}
