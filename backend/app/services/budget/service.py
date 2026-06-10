from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import BudgetLimit


class BudgetService:
    async def list_budgets(self, db: AsyncSession, user_id: UUID) -> list[BudgetLimit]:
        result = await db.execute(select(BudgetLimit).where(BudgetLimit.user_id == user_id))
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, user_id: UUID, category: str, monthly_limit: Decimal) -> BudgetLimit:
        budget = BudgetLimit(user_id=user_id, category=category, monthly_limit=monthly_limit)
        db.add(budget)
        await db.commit()
        await db.refresh(budget)
        return budget

    async def update(self, db: AsyncSession, budget_id: UUID, user_id: UUID, monthly_limit: Decimal) -> BudgetLimit:
        budget = await db.get(BudgetLimit, budget_id)
        if not budget or budget.user_id != user_id:
            raise ValueError("Bütçe bulunamadı")
        budget.monthly_limit = monthly_limit
        await db.commit()
        await db.refresh(budget)
        return budget

    async def delete(self, db: AsyncSession, budget_id: UUID, user_id: UUID) -> None:
        budget = await db.get(BudgetLimit, budget_id)
        if not budget or budget.user_id != user_id:
            raise ValueError("Bütçe bulunamadı")
        await db.delete(budget)
        await db.commit()
