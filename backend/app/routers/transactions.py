from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.receipt import Receipt
from app.models.transaction import Transaction
from app.models.user import User
from app.services.storage.service import StorageService

router = APIRouter(prefix="/transactions", tags=["Transactions"])
storage_service = StorageService()


@router.get("/")
async def list_transactions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=200),
    category: str | None = None,
):
    query = select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.created_at.desc()).limit(limit)
    if category:
        query = query.where(Transaction.category == category)
    result = await db.execute(query)
    rows = []
    for t in result.scalars().all():
        receipt_url = None
        if t.receipt_id:
            receipt = await db.get(Receipt, t.receipt_id)
            if receipt and receipt.image_url:
                receipt_url = await storage_service.get_url(receipt.image_url)
        rows.append({
            "id": str(t.id),
            "amount": float(t.amount),
            "currency": t.currency,
            "category": t.category,
            "description": t.description,
            "place": t.place,
            "type": t.transaction_type.value,
            "input_method": t.input_method,
            "date": t.created_at.isoformat(),
            "receipt_id": str(t.receipt_id) if t.receipt_id else None,
            "receipt_url": receipt_url,
        })
    return rows
