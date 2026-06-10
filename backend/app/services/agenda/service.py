from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy import and_, extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError
from app.models.agenda import AgendaItem, AgendaStatus
from app.services.wallet.service import WalletService


class AgendaService:
    def __init__(self):
        self.wallet_service = WalletService()

    async def add_bill(
        self, db: AsyncSession, user_id: UUID, title: str, amount: Decimal,
        due_date: datetime, is_recurring: bool = False, force: bool = False,
    ) -> AgendaItem:
        if not force:
            duplicate = await self._check_duplicate(db, user_id, title)
            if duplicate:
                raise I18nError("agenda.duplicate_bill", title=title)

        item = AgendaItem(
            user_id=user_id, title=title, amount=amount,
            due_date=due_date, is_recurring=is_recurring,
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return item

    async def create_installments(
        self, db: AsyncSession, user_id: UUID, title: str,
        total: Decimal, count: int, start_date: datetime | None = None,
    ) -> list[AgendaItem]:
        start = start_date or datetime.utcnow()
        per_installment = total / count
        items = []
        parent = AgendaItem(
            user_id=user_id, title=title, amount=per_installment,
            due_date=start, installment_total=count, installment_current=1,
        )
        db.add(parent)
        await db.flush()
        items.append(parent)

        for i in range(1, count):
            item = AgendaItem(
                user_id=user_id, title=f"{title} ({i + 1}/{count})",
                amount=per_installment, due_date=start + relativedelta(months=i),
                installment_total=count, installment_current=i + 1,
                parent_id=parent.id,
            )
            db.add(item)
            items.append(item)

        await db.commit()
        return items

    async def mark_paid(self, db: AsyncSession, user_id: UUID, title: str, wallet_id: UUID | None = None) -> AgendaItem:
        result = await db.execute(
            select(AgendaItem).where(
                AgendaItem.user_id == user_id,
                AgendaItem.title.ilike(f"%{title}%"),
                AgendaItem.status == AgendaStatus.PENDING,
            ).order_by(AgendaItem.due_date)
        )
        item = result.scalars().first()
        if not item:
            raise I18nError("agenda.not_found_title", title=title)

        item.status = AgendaStatus.PAID
        if wallet_id:
            await self.wallet_service.add_expense(
                db, user_id, wallet_id, item.amount,
                category="Fatura", description=item.title, input_method="voice",
            )
        await db.commit()
        return item

    async def list_upcoming(self, db: AsyncSession, user_id: UUID, days: int = 30) -> list[AgendaItem]:
        cutoff = datetime.utcnow() + timedelta(days=days)
        result = await db.execute(
            select(AgendaItem).where(
                AgendaItem.user_id == user_id,
                AgendaItem.status == AgendaStatus.PENDING,
                AgendaItem.due_date <= cutoff,
            ).order_by(AgendaItem.due_date)
        )
        return list(result.scalars().all())

    async def _check_duplicate(self, db: AsyncSession, user_id: UUID, title: str) -> bool:
        now = datetime.utcnow()
        result = await db.execute(
            select(AgendaItem).where(
                and_(
                    AgendaItem.user_id == user_id,
                    AgendaItem.title.ilike(f"%{title}%"),
                    extract("month", AgendaItem.created_at) == now.month,
                    extract("year", AgendaItem.created_at) == now.year,
                )
            )
        )
        return result.scalars().first() is not None
