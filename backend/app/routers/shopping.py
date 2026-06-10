from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error, t
from app.models.user import User
from app.services.shopping.service import ShoppingService

router = APIRouter(prefix="/shopping", tags=["Shopping"])
shopping_service = ShoppingService()


class AddItemsRequest(BaseModel):
    items: list[str]


class RoutineRequest(BaseModel):
    is_routine: bool
    routine_type: str | None = "daily"


@router.get("/")
async def list_items(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await shopping_service.list_active(db, user.id)
    grouped: dict[str, list] = {}
    for item in items:
        cat = item.category.value
        grouped.setdefault(cat, []).append({
            "id": str(item.id), "name": item.name,
            "is_routine": item.is_routine,
            "routine_type": item.routine_type or "daily",
        })
    return grouped


@router.post("/add")
async def add_items(data: AddItemsRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    created = await shopping_service.add_items(db, user.id, data.items)
    return {"added": len(created), "items": [i.name for i in created]}


@router.post("/complete/{item_id}")
async def complete_item(
    item_id: UUID, price: float | None = None, wallet_id: UUID | None = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        item = await shopping_service.complete_item(
            db, user.id, item_id,
            Decimal(str(price)) if price else None, wallet_id,
        )
        return {"id": str(item.id), "completed": True, "price": float(item.price) if item.price else None}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))


@router.patch("/{item_id}/routine")
async def set_routine(
    item_id: UUID, data: RoutineRequest,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    from app.models.shopping import ShoppingItem
    item = await db.get(ShoppingItem, item_id)
    if not item or item.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("shopping.item_not_found", user_locale(user)))
    item.is_routine = data.is_routine
    item.routine_type = data.routine_type
    await db.commit()
    return {"id": str(item.id), "is_routine": item.is_routine}
