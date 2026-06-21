from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import BudgetLimit
from app.models.insight import FinancialInsight, InsightType
from app.models.transaction import Transaction, TransactionType


class InsightService:
    async def list_recent(self, db: AsyncSession, user_id: UUID, limit: int = 20) -> list[FinancialInsight]:
        result = await db.execute(
            select(FinancialInsight)
            .where(FinancialInsight.user_id == user_id)
            .order_by(FinancialInsight.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def generate_weekly(self, db: AsyncSession, user_id: UUID, locale: str = "tr") -> list[FinancialInsight]:
        start = datetime.utcnow() - timedelta(days=7)
        result = await db.execute(
            select(Transaction.transaction_type, func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.user_id == user_id, Transaction.created_at >= start)
            .group_by(Transaction.transaction_type)
        )
        totals = {row[0].value: float(row[1]) for row in result.all()}
        income = totals.get(TransactionType.INCOME.value, 0)
        expense = totals.get(TransactionType.EXPENSE.value, 0)
        net = income - expense

        insights: list[FinancialInsight] = [
            FinancialInsight(
                user_id=user_id,
                insight_type=InsightType.WEEKLY_SUMMARY,
                title="Haftalık finans özeti" if locale == "tr" else "Weekly finance summary",
                summary=(
                    f"Bu hafta gelir {income:.2f}, gider {expense:.2f}, net akış {net:.2f}."
                    if locale == "tr"
                    else f"This week income is {income:.2f}, expense is {expense:.2f}, net cashflow is {net:.2f}."
                ),
                severity="success" if net >= 0 else "warning",
                payload={"income": income, "expense": expense, "net": net},
            )
        ]

        now = datetime.utcnow()
        budgets = await db.execute(select(BudgetLimit).where(BudgetLimit.user_id == user_id))
        for budget in budgets.scalars().all():
            spent_result = await db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.user_id == user_id,
                    Transaction.transaction_type == TransactionType.EXPENSE,
                    Transaction.category == budget.category,
                    extract("month", Transaction.created_at) == now.month,
                    extract("year", Transaction.created_at) == now.year,
                )
            )
            spent = float(spent_result.scalar() or 0)
            limit = float(budget.monthly_limit)
            percent = 0 if limit <= 0 else (spent / limit) * 100
            if percent >= 80:
                insights.append(FinancialInsight(
                    user_id=user_id,
                    insight_type=InsightType.BUDGET_RISK,
                    title=f"{budget.category} bütçe riski" if locale == "tr" else f"{budget.category} budget risk",
                    summary=(
                        f"{budget.category} bütçesinin %{percent:.0f} seviyesine ulaşıldı."
                        if locale == "tr"
                        else f"{budget.category} budget has reached {percent:.0f}%."
                    ),
                    severity="danger" if percent >= 100 else "warning",
                    payload={"category": budget.category, "spent": spent, "limit": limit, "percent": percent},
                ))

        for insight in insights:
            db.add(insight)
        await db.commit()
        for insight in insights:
            await db.refresh(insight)
        return insights
