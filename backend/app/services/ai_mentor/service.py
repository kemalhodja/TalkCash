from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.budget import BudgetLimit
from app.models.transaction import Transaction, TransactionType


class AIMentorService:
    async def check_budget_alerts(self, db: AsyncSession, user_id: UUID, locale: str = "tr") -> list[dict]:
        alerts = []
        now = datetime.utcnow()
        budgets = await db.execute(select(BudgetLimit).where(BudgetLimit.user_id == user_id))

        for budget in budgets.scalars().all():
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
            ratio = float(spent / budget.monthly_limit) if budget.monthly_limit > 0 else 0

            if ratio >= 1.0:
                alerts.append({
                    "type": "budget_exceeded",
                    "category": budget.category,
                    "message": t("ai.budget_exceeded", locale,
                                 category=budget.category, spent=spent, limit=budget.monthly_limit),
                })
            elif ratio >= 0.8:
                alerts.append({
                    "type": "budget_warning",
                    "category": budget.category,
                    "message": t("ai.budget_warning", locale,
                                 category=budget.category, percent=int(ratio * 100)),
                })
        return alerts

    async def predict_month_end(
        self, db: AsyncSession, user_id: UUID, current_balance: Decimal, locale: str = "tr",
    ) -> dict:
        now = datetime.utcnow()
        days_passed = max(now.day, 1)
        days_in_month = 30

        spent_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.transaction_type == TransactionType.EXPENSE,
                extract("month", Transaction.created_at) == now.month,
            )
        )
        total_spent = Decimal(str(spent_result.scalar() or 0))
        burn_rate = total_spent / days_passed
        projected = current_balance - (burn_rate * (days_in_month - days_passed))

        return {
            "burn_rate_daily": round(burn_rate, 2),
            "projected_balance": round(projected, 2),
            "warning": projected < 0,
            "message": (
                t("ai.forecast_negative", locale)
                if projected < 0
                else t("ai.forecast_positive", locale, balance=f"{projected:.2f}")
            ),
        }

    async def price_change_report(
        self, db: AsyncSession, user_id: UUID, product_name: str, locale: str = "tr",
    ) -> dict | None:
        now = datetime.utcnow()
        this_month = await db.execute(
            select(func.avg(Transaction.amount)).where(
                Transaction.user_id == user_id,
                Transaction.description.ilike(f"%{product_name}%"),
                extract("month", Transaction.created_at) == now.month,
            )
        )
        last_month = await db.execute(
            select(func.avg(Transaction.amount)).where(
                Transaction.user_id == user_id,
                Transaction.description.ilike(f"%{product_name}%"),
                extract("month", Transaction.created_at) == now.month - 1,
            )
        )
        current = this_month.scalar()
        previous = last_month.scalar()
        if not current or not previous:
            return None

        change = ((float(current) - float(previous)) / float(previous)) * 100
        key = "ai.price_increased" if change > 0 else "ai.price_decreased"
        return {
            "product": product_name,
            "current_avg": round(float(current), 2),
            "previous_avg": round(float(previous), 2),
            "change_percent": round(change, 1),
            "message": t(key, locale, product=product_name, percent=f"{abs(change):.0f}"),
        }
