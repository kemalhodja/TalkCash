from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.social.service import SocialService

router = APIRouter(prefix="/social", tags=["Social"])
social_service = SocialService()


@router.post("/debt")
async def add_debt(
    user_id: UUID, person_name: str, amount: float,
    is_lent: bool = True, db: AsyncSession = Depends(get_db),
):
    record = await social_service.add_debt(db, user_id, person_name, Decimal(str(amount)), is_lent)
    return {"id": str(record.id), "person": record.person_name, "amount": float(record.amount)}


@router.post("/split")
async def split_bill(user_id: UUID, total: float, person_count: int = 2, db: AsyncSession = Depends(get_db)):
    bill = await social_service.split_bill(db, user_id, Decimal(str(total)), person_count)
    return {
        "per_person": float(bill.per_person),
        "share_message": bill.share_message,
    }
