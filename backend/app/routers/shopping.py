from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error, t
from app.models.user import User
from app.services.budget_notify import push_budget_alerts_after_expense
from app.services.shopping.service import ShoppingService
from app.services.shopping.vision import ShoppingVisionService
from app.utils.rate_limit import check_rate_limit
from app.utils.validation import validate_image_bytes

router = APIRouter(prefix="/shopping", tags=["Shopping"])
shopping_service = ShoppingService()
vision_service = ShoppingVisionService()


class AddItemsRequest(BaseModel):
    items: list[str]
    skip_suggestion: bool = False


class ImportReceiptRequest(BaseModel):
    receipt_id: UUID
    item_names: list[str] | None = None


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
async def add_items(
    data: AddItemsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    created, suggestion = await shopping_service.add_items(
        db, user.id, data.items, locale=lang, with_suggestion=not data.skip_suggestion,
    )
    response: dict = {"added": len(created), "items": [i.name for i in created]}
    if suggestion:
        response["suggestion"] = suggestion
    return response


@router.post("/scan-photo")
async def scan_shopping_photo(
    request: Request,
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    lang = user_locale(user)
    await check_rate_limit(request, "ocr", settings.ocr_rate_limit, identifier=str(user.id), strict=True)
    image_bytes = await image.read()
    try:
        validate_image_bytes(image_bytes, settings.ocr_max_upload_bytes)
    except ValueError:
        raise HTTPException(status_code=400, detail=t("ocr.invalid_image", lang))
    try:
        items = await vision_service.extract_items(image_bytes, locale=lang)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, lang))
    return {"items": items, "count": len(items)}


@router.post("/import-receipt")
async def import_from_receipt(
    data: ImportReceiptRequest,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        created, _ = await shopping_service.import_from_receipt(
            db, user.id, data.receipt_id, data.item_names,
        )
        return {"added": len(created), "items": [i.name for i in created]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))


@router.delete("/{item_id}")
async def delete_item(
    item_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        await shopping_service.delete_item(db, user.id, item_id)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))


@router.post("/complete/{item_id}")
async def complete_item(
    item_id: UUID, price: float | None = None, wallet_id: UUID | None = None,
    store_name: str | None = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    try:
        item, voice_alert, micro_extras = await shopping_service.complete_item(
            db, user.id, item_id,
            Decimal(str(price)) if price else None, wallet_id,
            store_name=store_name, locale=lang,
        )
        if price and wallet_id:
            await push_budget_alerts_after_expense(db, user.id, "Market", lang)
        response: dict = {
            "id": str(item.id), "completed": True,
            "price": float(item.price) if item.price else None,
            "store_name": store_name or "Genel",
        }
        if voice_alert:
            response["voice_alert"] = voice_alert
        response.update(micro_extras)
        return response
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
