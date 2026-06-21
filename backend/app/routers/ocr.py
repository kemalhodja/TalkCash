from datetime import datetime
from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import t
from app.models.receipt import Receipt
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.receipt import ReceiptUpdate
from app.services.billing.service import BillingService, EntitlementError
from app.services.ocr.service import OCRService
from app.services.storage.service import StorageService
from app.utils.rate_limit import check_rate_limit
from app.utils.validation import validate_image_bytes

router = APIRouter(prefix="/ocr", tags=["OCR"])
ocr_service = OCRService()
storage_service = StorageService()
billing_service = BillingService()


def _public_image_path(receipt_id: UUID) -> str:
    return f"ocr/{receipt_id}/image"


@router.post("/scan")
async def scan_receipt(
    request: Request,
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    await check_rate_limit(request, "ocr", settings.ocr_rate_limit, identifier=str(user.id), strict=True)
    try:
        await billing_service.consume_usage(db, user.id, "receipt_ocr")
    except EntitlementError:
        raise HTTPException(status_code=402, detail={"code": "premium_required", "entitlement": "receipt_ocr"})
    image_bytes = await image.read()
    try:
        validate_image_bytes(image_bytes, settings.ocr_max_upload_bytes)
    except ValueError:
        raise HTTPException(status_code=400, detail=t("ocr.invalid_image", lang))
    data = await ocr_service.extract_receipt_data(image_bytes, locale=lang)
    image_url = await storage_service.upload(str(user.id), image_bytes)

    receipt = Receipt(
        user_id=user.id,
        image_url=image_url,
        total_amount=data["total_amount"],
        receipt_date=data["receipt_date"],
        merchant=data["merchant"],
        ocr_raw_text=data["ocr_raw_text"],
        is_verified=bool(data["total_amount"]),
    )
    db.add(receipt)
    await db.commit()
    await db.refresh(receipt)

    return {
        "receipt_id": str(receipt.id),
        "total_amount": float(data["total_amount"]) if data["total_amount"] else None,
        "date": data["receipt_date"].isoformat() if data["receipt_date"] else None,
        "due_date": data["due_date"].isoformat() if data.get("due_date") else None,
        "merchant": data["merchant"],
        "verified": receipt.is_verified,
        "image_url": _public_image_path(receipt.id),
        "line_items": data.get("line_items", []),
        "suggested_category": data.get("suggested_category"),
    }


@router.get("/")
async def list_receipts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    merchant: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    verified: bool | None = None,
):
    query = select(Receipt).where(Receipt.user_id == user.id)
    if merchant:
        query = query.where(Receipt.merchant.ilike(f"%{merchant}%"))
    if from_date:
        query = query.where(Receipt.receipt_date >= datetime.fromisoformat(from_date.replace("Z", "")))
    if to_date:
        query = query.where(Receipt.receipt_date <= datetime.fromisoformat(to_date.replace("Z", "")))
    if verified is not None:
        query = query.where(Receipt.is_verified == verified)
    result = await db.execute(query.order_by(Receipt.created_at.desc()))
    items = []
    for r in result.scalars().all():
        url = await storage_service.get_url(r.image_url)
        if not url.startswith("http"):
            url = _public_image_path(r.id)
        items.append({
            "id": str(r.id),
            "total_amount": float(r.total_amount) if r.total_amount else None,
            "merchant": r.merchant,
            "date": r.receipt_date.isoformat() if r.receipt_date else None,
            "verified": r.is_verified,
            "image_url": url,
        })
    return items


@router.patch("/{receipt_id}")
async def update_receipt(
    receipt_id: UUID,
    body: ReceiptUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    receipt = await db.get(Receipt, receipt_id)
    if not receipt or receipt.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("ocr.receipt_not_found", lang))

    if body.merchant is not None:
        receipt.merchant = body.merchant.strip()
    if body.total_amount is not None:
        receipt.total_amount = Decimal(str(body.total_amount))
    if body.receipt_date is not None:
        receipt.receipt_date = body.parsed_date()
    await db.commit()
    await db.refresh(receipt)
    return {
        "id": str(receipt.id),
        "total_amount": float(receipt.total_amount) if receipt.total_amount else None,
        "merchant": receipt.merchant,
        "date": receipt.receipt_date.isoformat() if receipt.receipt_date else None,
        "verified": receipt.is_verified,
        "image_url": _public_image_path(receipt.id),
    }


@router.delete("/{receipt_id}")
async def delete_receipt(
    receipt_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    receipt = await db.get(Receipt, receipt_id)
    if not receipt or receipt.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("ocr.receipt_not_found", lang))

    await db.execute(
        update(Transaction).where(Transaction.receipt_id == receipt_id).values(receipt_id=None)
    )
    try:
        await storage_service.delete(receipt.image_url)
    except Exception:
        pass
    await db.delete(receipt)
    await db.commit()
    return {"status": "deleted", "id": str(receipt_id)}


@router.get("/{receipt_id}/image")
async def get_receipt_image(
    receipt_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    receipt = await db.get(Receipt, receipt_id)
    if not receipt or receipt.user_id != user.id:
        raise HTTPException(status_code=404, detail=t("ocr.receipt_not_found", lang))

    stored = receipt.image_url
    if stored.startswith("http"):
        return RedirectResponse(stored)

    try:
        data, media_type = await storage_service.read_bytes(stored)
        return Response(content=data, media_type=media_type)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=t("ocr.receipt_not_found", lang))


@router.post("/verify")
async def verify_receipt(
    transaction_amount: float,
    receipt_amount: float | None = None,
    receipt_id: UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    ocr_total = Decimal(str(receipt_amount)) if receipt_amount is not None else None
    if receipt_id:
        receipt = await db.get(Receipt, receipt_id)
        if not receipt or receipt.user_id != user.id:
            raise HTTPException(status_code=404, detail=t("ocr.receipt_not_found", lang))
        if ocr_total is None and receipt.total_amount is not None:
            ocr_total = receipt.total_amount
        verified = ocr_service.verify_transaction(
            ocr_total, Decimal(str(transaction_amount)),
        )
        receipt.is_verified = verified
        await db.commit()
        return {
            "verified": verified,
            "receipt_amount": float(ocr_total) if ocr_total is not None else None,
            "transaction_amount": transaction_amount,
        }
    verified = ocr_service.verify_transaction(
        ocr_total, Decimal(str(transaction_amount)),
    )
    return {"verified": verified, "receipt_amount": float(ocr_total) if ocr_total else None, "transaction_amount": transaction_amount}
