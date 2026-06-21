from uuid import UUID
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error
from app.models.receipt import Receipt
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionUpdate
from app.services.storage.service import StorageService
from app.services.subscription.manager import subscription_cancel_url
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
        "store_name": tx.store_name,
        "type": tx.transaction_type.value,
        "input_method": tx.input_method,
        "date": tx.created_at.isoformat(),
        "receipt_id": str(tx.receipt_id) if tx.receipt_id else None,
        "receipt_url": receipt_url,
        "is_recurring": tx.is_recurring,
        "next_billing_date": tx.next_billing_date.isoformat() if tx.next_billing_date else None,
        "subscription_name": tx.subscription_name,
    }


@router.get("/")
async def list_transactions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    category: str | None = None,
    search: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
):
    query = select(Transaction).where(Transaction.user_id == user.id)
    if category:
        query = query.where(Transaction.category == category)
    if search:
        like = f"%{search}%"
        query = query.where(or_(Transaction.description.ilike(like), Transaction.place.ilike(like), Transaction.category.ilike(like)))
    if from_date:
        query = query.where(Transaction.created_at >= datetime.fromisoformat(from_date.replace("Z", "")))
    if to_date:
        query = query.where(Transaction.created_at <= datetime.fromisoformat(to_date.replace("Z", "")))
    query = query.order_by(Transaction.created_at.desc()).limit(min(max(limit, 1), 500))
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


@router.get("/subscriptions/upcoming")
async def upcoming_subscriptions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 10,
):
    today = date.today()
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user.id,
            Transaction.is_recurring.is_(True),
            Transaction.next_billing_date.isnot(None),
            Transaction.next_billing_date >= today,
        ).order_by(Transaction.next_billing_date.asc()).limit(min(max(limit, 1), 20))
    )
    items = []
    for tx in result.scalars().all():
        provider = tx.subscription_name or "Abonelik"
        items.append({
            "id": str(tx.id),
            "subscription_name": provider,
            "amount": float(tx.amount),
            "next_billing_date": tx.next_billing_date.isoformat(),
            "cancel_url": subscription_cancel_url(provider),
        })
    return {"subscriptions": items}


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
