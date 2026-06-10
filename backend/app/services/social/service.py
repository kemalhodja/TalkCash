from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.social import DebtRecord, SplitBill


class SocialService:
    async def add_debt(
        self, db: AsyncSession, user_id: UUID, person_name: str,
        amount: Decimal, is_lent: bool = True,
    ) -> DebtRecord:
        record = DebtRecord(
            user_id=user_id, person_name=person_name,
            amount=amount, is_lent=is_lent,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record

    async def split_bill(self, db: AsyncSession, user_id: UUID, total: Decimal, person_count: int) -> SplitBill:
        per_person = (total / person_count).quantize(Decimal("0.01"))
        message = (
            f"Merhaba! Hesap toplamı {total} TL, {person_count} kişi arasında bölündü.\n"
            f"Kişi başı: {per_person} TL\n"
            f"— TalkCash ile paylaşıldı"
        )
        bill = SplitBill(
            user_id=user_id, total_amount=total,
            person_count=person_count, per_person=per_person,
            share_message=message,
        )
        db.add(bill)
        await db.commit()
        await db.refresh(bill)
        return bill
