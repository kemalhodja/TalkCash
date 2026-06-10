from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.social.service import SocialService
from app.services.social.shared_wallet_service import SharedWalletService

router = APIRouter(prefix="/social", tags=["Social"])
social_service = SocialService()
shared_service = SharedWalletService()


@router.post("/debt")
async def add_debt(
    person_name: str, amount: float, is_lent: bool = True,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    record = await social_service.add_debt(db, user.id, person_name, Decimal(str(amount)), is_lent)
    return {"id": str(record.id), "person": record.person_name, "amount": float(record.amount)}


@router.post("/split")
async def split_bill(
    total: float, person_count: int = 2,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    bill = await social_service.split_bill(db, user.id, Decimal(str(total)), person_count)
    return {
        "per_person": float(bill.per_person),
        "share_message": bill.share_message,
        "whatsapp_url": f"https://wa.me/?text={bill.share_message.replace(' ', '%20').replace(chr(10), '%0A')}",
    }


@router.post("/shared-wallet")
async def create_shared_wallet(
    name: str, member_ids: list[str] | None = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    members = [UUID(m) for m in (member_ids or [])]
    wallet = await shared_service.create(db, user.id, name, members)
    return {"id": str(wallet.id), "name": wallet.name, "balance": float(wallet.balance)}


@router.get("/shared-wallet")
async def list_shared_wallets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wallets = await shared_service.list_for_user(db, user.id)
    return [{"id": str(w.id), "name": w.name, "balance": float(w.balance)} for w in wallets]


@router.post("/shared-wallet/{wallet_id}/expense")
async def shared_wallet_expense(
    wallet_id: UUID, amount: float, description: str = "",
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        wallet = await shared_service.add_expense(
            db, wallet_id, Decimal(str(amount)), description, user.full_name or user.email,
        )
        return {"balance": float(wallet.balance)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
