from datetime import datetime, timedelta
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
        due = datetime.utcnow() + timedelta(days=30)
        record = DebtRecord(
            user_id=user_id, person_name=person_name,
            amount=amount, is_lent=is_lent, due_date=due,
        )
        db.add(record)
        await db.flush()

        from app.services.agenda.service import AgendaService
        agenda = AgendaService()
        title = f"{person_name} — {'alacak' if is_lent else 'borç'}"
        await agenda.add_bill(db, user_id, title, amount, due, force=True)

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

        from app.services.agenda.service import AgendaService
        agenda = AgendaService()
        try:
            await agenda.mark_paid(db, user_id, record.person_name, deduct_wallet=False)
        except I18nError:
            pass

        await db.commit()
        return record
