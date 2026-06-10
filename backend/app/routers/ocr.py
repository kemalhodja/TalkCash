from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.receipt import Receipt
from app.services.ocr.service import OCRService

router = APIRouter(prefix="/ocr", tags=["OCR"])
ocr_service = OCRService()


@router.post("/scan")
async def scan_receipt(user_id: UUID, image: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    image_bytes = await image.read()
    data = await ocr_service.extract_receipt_data(image_bytes)

    receipt = Receipt(
        user_id=user_id,
        image_url=f"uploads/{user_id}/{image.filename}",
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
    }


@router.post("/verify")
async def verify_receipt(receipt_amount: float, transaction_amount: float):
    from decimal import Decimal
    verified = ocr_service.verify_transaction(Decimal(str(receipt_amount)), Decimal(str(transaction_amount)))
    return {"verified": verified}
