from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError
from app.models.budget import BudgetLimit
from app.models.budget_overrun import BudgetOverrun
from app.models.transaction import Transaction, TransactionType


class BudgetService:
    async def list_budgets(self, db: AsyncSession, user_id: UUID) -> list[BudgetLimit]:
        result = await db.execute(select(BudgetLimit).where(BudgetLimit.user_id == user_id))
        return list(result.scalars().all())

    async def list_with_usage(self, db: AsyncSession, user_id: UUID) -> list[dict]:
        now = datetime.utcnow()
        budgets = await self.list_budgets(db, user_id)
        summaries = []
        for budget in budgets:
            spent_result = await db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.user_id == user_id,
                    Transaction.category == budget.category,
                    Transaction.transaction_type == TransactionType.EXPENSE,
                    extract("month", Transaction.created_at) == now.month,
                    extract("year", Transaction.created_at) == now.year,
                )
            )
            spent = Decimal(str(spent_result.scalar() or 0))
            percent = float(spent / budget.monthly_limit * 100) if budget.monthly_limit > 0 else 0
            summaries.append({
                "id": budget.id,
                "category": budget.category,
                "monthly_limit": budget.monthly_limit,
                "currency": budget.currency,
                "created_at": budget.created_at,
                "spent": spent,
                "percent": round(percent, 1),
            })
        return summaries

    async def create(self, db: AsyncSession, user_id: UUID, category: str, monthly_limit: Decimal) -> BudgetLimit:
        budget = BudgetLimit(user_id=user_id, category=category, monthly_limit=monthly_limit)
        db.add(budget)
        await db.commit()
        await db.refresh(budget)
        return budget

    async def update(
        self,
        db: AsyncSession,
        budget_id: UUID,
        user_id: UUID,
        monthly_limit: Decimal | None = None,
        category: str | None = None,
    ) -> BudgetLimit:
        budget = await db.get(BudgetLimit, budget_id)
        if not budget or budget.user_id != user_id:
            raise I18nError("budget.not_found")
        if monthly_limit is not None:
            budget.monthly_limit = monthly_limit
        if category is not None:
            budget.category = category
        await db.commit()
        await db.refresh(budget)
        return budget

    async def delete(self, db: AsyncSession, budget_id: UUID, user_id: UUID) -> None:
        budget = await db.get(BudgetLimit, budget_id)
        if not budget or budget.user_id != user_id:
            raise I18nError("budget.not_found")
        await db.delete(budget)
        await db.commit()

    async def record_overrun(
        self, db: AsyncSession, user_id: UUID, category: str,
        monthly_limit: Decimal, spent: Decimal, month: int, year: int,
    ) -> None:
        existing = await db.execute(
            select(BudgetOverrun).where(
                BudgetOverrun.user_id == user_id,
                BudgetOverrun.category == category,
                BudgetOverrun.month == month,
                BudgetOverrun.year == year,
            )
        )
        if existing.scalars().first():
            return
        db.add(BudgetOverrun(
            user_id=user_id,
            category=category,
            monthly_limit=monthly_limit,
            spent=spent,
            month=month,
            year=year,
        ))
        await db.commit()

    async def list_overruns(self, db: AsyncSession, user_id: UUID, limit: int = 20) -> list[dict]:
        result = await db.execute(
            select(BudgetOverrun)
            .where(BudgetOverrun.user_id == user_id)
            .order_by(BudgetOverrun.created_at.desc())
            .limit(limit)
        )
        rows = result.scalars().all()
        return [
            {
                "id": str(r.id),
                "category": r.category,
                "monthly_limit": float(r.monthly_limit),
                "spent": float(r.spent),
                "month": r.month,
                "year": r.year,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
