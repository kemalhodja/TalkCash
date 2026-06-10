from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError, t
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

    async def split_bill(
        self, db: AsyncSession, user_id: UUID, total: Decimal, person_count: int, locale: str = "tr",
    ) -> SplitBill:
        per_person = (total / person_count).quantize(Decimal("0.01"))
        message = t(
            "social.split_message", locale,
            total=total, count=person_count, per_person=per_person,
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

    async def list_debts(self, db: AsyncSession, user_id: UUID) -> list[DebtRecord]:
        result = await db.execute(
            select(DebtRecord).where(DebtRecord.user_id == user_id, DebtRecord.is_settled == False)
        )
        return list(result.scalars().all())

    async def settle_debt(self, db: AsyncSession, user_id: UUID, debt_id: UUID) -> DebtRecord:
        record = await db.get(DebtRecord, debt_id)
        if not record or record.user_id != user_id:
            raise I18nError("debt.not_found")
        record.is_settled = True
        await db.commit()
        return record
