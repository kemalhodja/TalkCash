from decimal import Decimal
from uuid import UUID

from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error
from app.models.user import User
from app.services.social.service import SocialService
from app.services.social.shared_wallet_service import SharedWalletService

router = APIRouter(prefix="/social", tags=["Social"])
social_service = SocialService()
shared_service = SharedWalletService()


@router.get("/debts")
async def list_debts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    records = await social_service.list_debts(db, user.id)
    return [
        {
            "id": str(r.id), "person": r.person_name, "amount": float(r.amount),
            "is_lent": r.is_lent, "due_date": r.due_date.isoformat() if r.due_date else None,
        }
        for r in records
    ]


@router.post("/debts/{debt_id}/settle")
async def settle_debt(debt_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        record = await social_service.settle_debt(db, user.id, debt_id)
        return {"id": str(record.id), "settled": True}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))


@router.patch("/debts/{debt_id}")
async def update_debt(
    debt_id: UUID,
    person_name: str | None = None,
    amount: float | None = None,
    is_lent: bool | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        record = await social_service.update_debt(
            db, user.id, debt_id, person_name,
            Decimal(str(amount)) if amount is not None else None,
            is_lent,
        )
        return {
            "id": str(record.id), "person": record.person_name, "amount": float(record.amount),
            "is_lent": record.is_lent,
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))


@router.delete("/debts/{debt_id}")
async def delete_debt(debt_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        await social_service.delete_debt(db, user.id, debt_id)
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))


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
    bill = await social_service.split_bill(db, user.id, Decimal(str(total)), person_count, user_locale(user))
    return {
        "per_person": float(bill.per_person),
        "share_message": bill.share_message,
        "whatsapp_url": f"https://wa.me/?text={quote(bill.share_message)}",
    }


@router.post("/shared-wallet")
async def create_shared_wallet(
    name: str, member_email: str | None = None, member_ids: list[str] | None = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    members: list[UUID] = [UUID(m) for m in (member_ids or [])]
    if member_email:
        result = await db.execute(select(User).where(User.email == member_email.strip().lower()))
        found = result.scalars().first()
        if found and found.id != user.id:
            members.append(found.id)
    wallet = await shared_service.create(db, user.id, name, members)
    return {"id": str(wallet.id), "name": wallet.name, "balance": float(wallet.balance)}


@router.get("/shared-wallet")
async def list_shared_wallets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wallets = await shared_service.list_for_user(db, user.id)
    return [
        {
            "id": str(w.id), "name": w.name, "balance": float(w.balance),
            "owner_id": str(w.owner_id), "is_owner": w.owner_id == user.id,
        }
        for w in wallets
    ]


@router.patch("/shared-wallet/{wallet_id}")
async def rename_shared_wallet(
    wallet_id: UUID, name: str,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        wallet = await shared_service.rename(db, wallet_id, user.id, name)
        return {"id": str(wallet.id), "name": wallet.name}
    except Exception as e:
        raise HTTPException(status_code=403, detail=resolve_error(e, user_locale(user)))


@router.post("/shared-wallet/{wallet_id}/members")
async def add_shared_wallet_member(
    wallet_id: UUID, member_email: str,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        wallet = await shared_service.add_member(db, wallet_id, user.id, member_email)
        return {"id": str(wallet.id), "name": wallet.name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))


@router.delete("/shared-wallet/{wallet_id}/members/{member_id}")
async def remove_shared_wallet_member(
    wallet_id: UUID, member_id: UUID,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        wallet = await shared_service.remove_member(db, wallet_id, user.id, member_id)
        return {"id": str(wallet.id), "members_removed": str(member_id)}
    except Exception as e:
        raise HTTPException(status_code=403, detail=resolve_error(e, user_locale(user)))


@router.post("/shared-wallet/{wallet_id}/transfer")
async def transfer_shared_wallet_ownership(
    wallet_id: UUID, member_id: UUID,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        wallet = await shared_service.transfer_ownership(db, wallet_id, user.id, member_id)
        return {
            "id": str(wallet.id),
            "owner_id": str(wallet.owner_id),
            "name": wallet.name,
        }
    except Exception as e:
        raise HTTPException(status_code=403, detail=resolve_error(e, user_locale(user)))


@router.delete("/shared-wallet/{wallet_id}")
async def delete_shared_wallet(
    wallet_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await shared_service.delete_wallet(db, wallet_id, user.id)
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=403, detail=resolve_error(e, user_locale(user)))


@router.post("/shared-wallet/{wallet_id}/expense")
async def shared_wallet_expense(
    wallet_id: UUID, amount: float, description: str = "",
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        wallet = await shared_service.add_expense(
            db, wallet_id, Decimal(str(amount)), description, user.full_name or user.email,
            user_id=user.id,
        )
        return {"balance": float(wallet.balance)}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))


@router.post("/shared-wallet/{wallet_id}/contribution")
async def shared_wallet_contribution(
    wallet_id: UUID, amount: float, description: str = "",
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        wallet = await shared_service.add_contribution(
            db, wallet_id, user.id, Decimal(str(amount)), description,
        )
        return {"balance": float(wallet.balance)}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))


@router.get("/shared-wallet/{wallet_id}/members")
async def shared_wallet_members(
    wallet_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        return await shared_service.get_member_summary(db, wallet_id, user.id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))
