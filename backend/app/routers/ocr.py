import uuid
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.receipt import Receipt
from app.models.user import User
from app.services.ocr.service import OCRService

router = APIRouter(prefix="/ocr", tags=["OCR"])
ocr_service = OCRService()
UPLOAD_DIR = Path("uploads")


@router.post("/scan")
async def scan_receipt(
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    image_bytes = await image.read()
    data = await ocr_service.extract_receipt_data(image_bytes)

    user_dir = UPLOAD_DIR / str(user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    filepath = user_dir / filename
    filepath.write_bytes(image_bytes)

    receipt = Receipt(
        user_id=user.id,
        image_url=str(filepath),
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


@router.get("/")
async def list_receipts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Receipt).where(Receipt.user_id == user.id).order_by(Receipt.created_at.desc())
    )
    return [
        {
            "id": str(r.id),
            "total_amount": float(r.total_amount) if r.total_amount else None,
            "merchant": r.merchant,
            "date": r.receipt_date.isoformat() if r.receipt_date else None,
            "verified": r.is_verified,
            "image_url": r.image_url,
        }
        for r in result.scalars().all()
    ]


@router.post("/verify")
async def verify_receipt(receipt_amount: float, transaction_amount: float):
    verified = ocr_service.verify_transaction(Decimal(str(receipt_amount)), Decimal(str(transaction_amount)))
    return {"verified": verified}
