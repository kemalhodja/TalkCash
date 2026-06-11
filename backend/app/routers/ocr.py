from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import t
from app.models.receipt import Receipt
from app.models.user import User
from app.services.ocr.service import OCRService
from app.services.storage.service import StorageService
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/ocr", tags=["OCR"])
ocr_service = OCRService()
storage_service = StorageService()


@router.post("/scan")
async def scan_receipt(
    request: Request,
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    await check_rate_limit(request, "ocr", settings.ocr_rate_limit, identifier=str(user.id))
    image_bytes = await image.read()
    if len(image_bytes) > settings.ocr_max_upload_bytes:
        raise HTTPException(status_code=413, detail=t("ocr.file_too_large", lang))
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
        "merchant": data["merchant"],
        "verified": receipt.is_verified,
        "image_url": image_url,
        "line_items": data.get("line_items", []),
    }


@router.get("/")
async def list_receipts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Receipt).where(Receipt.user_id == user.id).order_by(Receipt.created_at.desc())
    )
    items = []
    for r in result.scalars().all():
        url = await storage_service.get_url(r.image_url)
        items.append({
            "id": str(r.id),
            "total_amount": float(r.total_amount) if r.total_amount else None,
            "merchant": r.merchant,
            "date": r.receipt_date.isoformat() if r.receipt_date else None,
            "verified": r.is_verified,
            "image_url": url,
        })
    return items


@router.post("/verify")
async def verify_receipt(
    transaction_amount: float,
    receipt_amount: float | None = None,
    receipt_id: UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ocr_total = Decimal(str(receipt_amount)) if receipt_amount is not None else None
    if receipt_id:
        receipt = await db.get(Receipt, receipt_id)
        if not receipt or receipt.user_id != user.id:
            raise HTTPException(status_code=404, detail="Receipt not found")
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
