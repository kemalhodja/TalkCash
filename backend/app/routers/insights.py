from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_premium, user_locale
from app.models.billing import Subscription
from app.models.budget import BudgetLimit
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.models.wallet import Wallet
from app.services.micro_savings.service import MicroSavingsService
from app.services.wallet.service import WalletService

router = APIRouter(prefix="/insights", tags=["Insights"])
wallet_service = WalletService()
micro_savings_service = MicroSavingsService()


@router.get("/summary")
async def insight_summary(
    _subscription: Subscription = Depends(require_premium()),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    month_filter = (
        Transaction.user_id == user.id,
        extract("month", Transaction.created_at) == now.month,
        extract("year", Transaction.created_at) == now.year,
    )

    totals_result = await db.execute(
        select(Transaction.transaction_type, func.coalesce(func.sum(Transaction.amount), 0))
        .where(*month_filter)
        .group_by(Transaction.transaction_type)
    )
    totals = {row[0].value: float(row[1]) for row in totals_result.all()}

    category_result = await db.execute(
        select(Transaction.category, func.coalesce(func.sum(Transaction.amount), 0))
        .where(*month_filter, Transaction.transaction_type == TransactionType.EXPENSE)
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(8)
    )
    categories = [{"category": row[0] or "Genel", "amount": float(row[1])} for row in category_result.all()]

    budgets_result = await db.execute(select(BudgetLimit).where(BudgetLimit.user_id == user.id))
    budgets = list(budgets_result.scalars().all())
    budget_health = []
    for budget in budgets:
        spent = next((c["amount"] for c in categories if c["category"] == budget.category), 0)
        limit = float(budget.monthly_limit)
        percent = 0 if limit <= 0 else round((spent / limit) * 100, 1)
        budget_health.append({
            "category": budget.category,
            "spent": spent,
            "limit": limit,
            "percent": percent,
            "status": "danger" if percent >= 100 else "warning" if percent >= 80 else "ok",
        })

    wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == user.id, Wallet.is_active == True))
    wallets = [
        {
            "id": str(wallet.id),
            "name": wallet.name,
            "balance": float(wallet.balance),
            "currency": wallet.currency,
            "type": wallet.wallet_type.value,
        }
        for wallet in wallet_result.scalars().all()
    ]
    net_worth = await wallet_service.get_net_worth(db, user.id)

    income = totals.get(TransactionType.INCOME.value, 0)
    expense = totals.get(TransactionType.EXPENSE.value, 0)
    micro_savings = await micro_savings_service.get_premium_insights(
        db, user.id, user_locale(user),
    )
    monthly = await wallet_service.monthly_summary(db, user.id)
    return {
        "month": now.strftime("%Y-%m"),
        "cashflow": {
            "income": income,
            "expense": expense,
            "net": income - expense,
            "savings_rate": round(((income - expense) / income) * 100, 1) if income > 0 else None,
        },
        "net_worth_total": float(net_worth.total_try),
        "top_categories": categories,
        "budget_health": budget_health,
        "trends": monthly.get("trends", []),
        "narratives": monthly.get("narratives", []),
        "wallets": wallets,
        "micro_savings": micro_savings,
    }
