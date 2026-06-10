from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.budget import BudgetLimit
from app.models.receipt import Receipt
from app.models.transaction import Transaction, TransactionType
from app.services.ocr.service import OCRService


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

    async def _avg_product_price_from_receipts(
        self, db: AsyncSession, user_id: UUID, product_name: str, month: int, year: int,
    ) -> float | None:
        ocr = OCRService()
        result = await db.execute(
            select(Receipt).where(
                Receipt.user_id == user_id,
                Receipt.ocr_raw_text.isnot(None),
                extract("month", Receipt.receipt_date) == month,
                extract("year", Receipt.receipt_date) == year,
            )
        )
        prices = []
        for receipt in result.scalars().all():
            price = ocr.extract_product_price(receipt.ocr_raw_text or "", product_name)
            if price:
                prices.append(float(price))
        return sum(prices) / len(prices) if prices else None

    async def _avg_product_price_from_transactions(
        self, db: AsyncSession, user_id: UUID, product_name: str, month: int, year: int,
    ) -> float | None:
        result = await db.execute(
            select(func.avg(Transaction.amount)).where(
                Transaction.user_id == user_id,
                Transaction.description.ilike(f"%{product_name}%"),
                extract("month", Transaction.created_at) == month,
                extract("year", Transaction.created_at) == year,
            )
        )
        val = result.scalar()
        return float(val) if val else None

    async def price_change_report(
        self, db: AsyncSession, user_id: UUID, product_name: str, locale: str = "tr",
    ) -> dict | None:
        now = datetime.utcnow()
        prev_month = now.month - 1 if now.month > 1 else 12
        prev_year = now.year if now.month > 1 else now.year - 1

        current = await self._avg_product_price_from_receipts(db, user_id, product_name, now.month, now.year)
        previous = await self._avg_product_price_from_receipts(db, user_id, product_name, prev_month, prev_year)
        source = "ocr"

        if current is None:
            current = await self._avg_product_price_from_transactions(db, user_id, product_name, now.month, now.year)
            source = "transactions"
        if previous is None:
            previous = await self._avg_product_price_from_transactions(db, user_id, product_name, prev_month, prev_year)

        if not current or not previous:
            return None

        change = ((current - previous) / previous) * 100
        key = "ai.price_increased" if change > 0 else "ai.price_decreased"
        return {
            "product": product_name,
            "current_avg": round(current, 2),
            "previous_avg": round(previous, 2),
            "change_percent": round(change, 1),
            "source": source,
            "message": t(key, locale, product=product_name, percent=f"{abs(change):.0f}"),
        }
