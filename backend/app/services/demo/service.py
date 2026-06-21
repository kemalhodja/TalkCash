from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.services.agenda.service import AgendaService
from app.services.budget.service import BudgetService
from app.services.wallet.service import WalletService

wallet_service = WalletService()
budget_service = BudgetService()
agenda_service = AgendaService()


async def seed_demo_data(db: AsyncSession, user_id, locale: str = "tr") -> dict:
    count_result = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.user_id == user_id)
    )
    if (count_result.scalar() or 0) > 0:
        return {"status": "already_seeded"}

    nakit = await wallet_service.find_by_name(db, user_id, "Nakit")
    banka = await wallet_service.find_by_name(db, user_id, "Banka")
    if not nakit or not banka:
        await wallet_service.create_defaults(db, user_id)
        nakit = await wallet_service.find_by_name(db, user_id, "Nakit")
        banka = await wallet_service.find_by_name(db, user_id, "Banka")
    if not nakit or not banka:
        raise ValueError("wallet.not_found")

    await wallet_service.add_income(
        db, user_id, banka.id, Decimal("18500"), "Maaş" if locale == "tr" else "Salary"
    )
    await wallet_service.add_income(
        db, user_id, nakit.id, Decimal("5000"), "Nakit" if locale == "tr" else "Cash float"
    )

    samples = [
        (Decimal("89.50"), "Market", "Haftalık alışveriş" if locale == "tr" else "Weekly groceries"),
        (Decimal("42"), "Ulaşım", "Metro" if locale == "tr" else "Metro fare"),
        (Decimal("156"), "Yemek", "Restoran" if locale == "tr" else "Restaurant"),
        (Decimal("320"), "Faturalar", "Elektrik" if locale == "tr" else "Electricity"),
        (Decimal("65"), "Kahve", "Kafe" if locale == "tr" else "Coffee shop"),
    ]
    for amount, category, description in samples:
        await wallet_service.add_expense(
            db, user_id, nakit.id, amount, category, description, "", input_method="demo",
        )

    await budget_service.create(
        db, user_id, "Market" if locale == "tr" else "Groceries", Decimal("2500")
    )
    await agenda_service.add_bill(
        db,
        user_id,
        "İnternet" if locale == "tr" else "Internet",
        Decimal("450"),
        datetime.utcnow() + timedelta(days=5),
        is_recurring=False,
    )

    from app.models.user import User
    from app.services.micro_savings.prefs import DEFAULT_MICRO_SAVINGS_PREFS, serialize_micro_savings_prefs
    from app.services.micro_savings.service import MicroSavingsService

    user = await db.get(User, user_id)
    if user:
        prefs = {**DEFAULT_MICRO_SAVINGS_PREFS, "round_up_enabled": True, "round_up_step": 10}
        user.micro_savings_prefs = serialize_micro_savings_prefs(prefs)

    altin = await wallet_service.find_by_name(db, user_id, "Altın")
    micro_demo = False
    if altin and nakit:
        try:
            await MicroSavingsService().transfer_savings(
                db, user_id, nakit.id, altin.id, Decimal("47"), "coffee", locale,
            )
            micro_demo = True
        except Exception:
            pass

    await db.commit()
    return {"status": "seeded", "transactions": len(samples) + 1, "micro_savings_demo": micro_demo}
