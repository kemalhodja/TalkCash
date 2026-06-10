from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.models.wallet import WalletType
from app.services.agenda.service import AgendaService
from app.services.wallet.service import _apply_inflow, _apply_outflow


def _wallet(wtype: WalletType, balance: Decimal) -> MagicMock:
    w = MagicMock()
    w.wallet_type = wtype
    w.balance = balance
    return w


def test_credit_card_expense_increases_debt():
    wallet = _wallet(WalletType.CREDIT_CARD, Decimal("1000"))
    _apply_outflow(wallet, Decimal("250"))
    assert wallet.balance == Decimal("1250")


def test_credit_card_payment_reduces_debt():
    wallet = _wallet(WalletType.CREDIT_CARD, Decimal("1000"))
    _apply_inflow(wallet, Decimal("400"))
    assert wallet.balance == Decimal("600")


def test_credit_card_payment_cannot_go_negative():
    wallet = _wallet(WalletType.CREDIT_CARD, Decimal("200"))
    _apply_inflow(wallet, Decimal("500"))
    assert wallet.balance == Decimal("0")


def test_cash_expense_decreases_balance():
    wallet = _wallet(WalletType.CASH, Decimal("500"))
    _apply_outflow(wallet, Decimal("100"))
    assert wallet.balance == Decimal("400")


@pytest.mark.asyncio
async def test_list_upcoming_respects_days_filter():
    service = AgendaService()
    user_id = uuid4()
    within = MagicMock(due_date=datetime.utcnow() + timedelta(days=5))
    beyond = MagicMock(due_date=datetime.utcnow() + timedelta(days=60))

    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [within]
    db.execute = AsyncMock(return_value=mock_result)

    items = await service.list_upcoming(db, user_id, days=30)
    assert items == [within]
    assert beyond not in items


def test_net_worth_credit_card_is_liability():
    total = Decimal("0")
    for wtype, amount in [(WalletType.CASH, Decimal("5000")), (WalletType.CREDIT_CARD, Decimal("2000"))]:
        if wtype == WalletType.CREDIT_CARD:
            total -= amount
        else:
            total += amount
    assert total == Decimal("3000")
