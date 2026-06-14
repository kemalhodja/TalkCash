from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error
from app.models.receipt import Receipt
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionUpdate
from app.services.storage.service import StorageService
from app.services.transaction.service import TransactionService
from app.services.wallet.service import WalletService

router = APIRouter(prefix="/transactions", tags=["Transactions"])
storage_service = StorageService()
tx_service = TransactionService()
wallet_service = WalletService()


def _serialize(tx: Transaction, receipt_url: str | None = None) -> dict:
    return {
        "id": str(tx.id),
        "amount": float(tx.amount),
        "currency": tx.currency,
        "category": tx.category,
        "description": tx.description,
        "place": tx.place,
        "type": tx.transaction_type.value,
        "input_method": tx.input_method,
        "date": tx.created_at.isoformat(),
        "receipt_id": str(tx.receipt_id) if tx.receipt_id else None,
        "receipt_url": receipt_url,
    }


@router.get("/")
async def list_transactions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    category: str | None = None,
):
    from sqlalchemy import select

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
        rows.append(_serialize(t, receipt_url))
    return rows


@router.patch("/{transaction_id}")
async def update_transaction(
    transaction_id: UUID,
    data: TransactionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        tx = await tx_service.update(db, user.id, transaction_id, data)
        receipt_url = None
        if tx.receipt_id:
            receipt = await db.get(Receipt, tx.receipt_id)
            if receipt and receipt.image_url:
                receipt_url = await storage_service.get_url(receipt.image_url)
        return _serialize(tx, receipt_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))


@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await tx_service.delete(db, user.id, transaction_id)
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))
