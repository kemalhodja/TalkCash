"""Security and validation tests for micro-savings transfers."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.i18n import I18nError
from app.models.wallet import Wallet, WalletType
from app.services.micro_savings.service import MAX_MICRO_SAVINGS_TRANSFER, MicroSavingsService


@pytest.fixture
def service():
    return MicroSavingsService()


@pytest.mark.asyncio
async def test_transfer_rejects_credit_card_source(service):
    user_id = uuid4()
    from_id, to_id = uuid4(), uuid4()
    from_w = Wallet(id=from_id, user_id=user_id, name="Kredi", wallet_type=WalletType.CREDIT_CARD, balance=Decimal("1000"))
    to_w = Wallet(id=to_id, user_id=user_id, name="Altın", wallet_type=WalletType.INVESTMENT_GOLD, balance=Decimal("0"))
    db = AsyncMock()

    async def get_owned(_db, uid, wid):
        return from_w if wid == from_id else to_w

    service.wallets.get_owned_wallet = AsyncMock(side_effect=get_owned)

    with pytest.raises(I18nError) as exc:
        await service.transfer_savings(db, user_id, from_id, to_id, Decimal("50"), "coffee", "tr")
    assert exc.value.key == "micro_savings.credit_card_source"


@pytest.mark.asyncio
async def test_transfer_rejects_non_investment_target(service):
    user_id = uuid4()
    from_id, to_id = uuid4(), uuid4()
    from_w = Wallet(id=from_id, user_id=user_id, name="Nakit", wallet_type=WalletType.CASH, balance=Decimal("1000"))
    to_w = Wallet(id=to_id, user_id=user_id, name="Banka", wallet_type=WalletType.BANK, balance=Decimal("0"))
    service.wallets.get_owned_wallet = AsyncMock(side_effect=lambda _db, _uid, wid: from_w if wid == from_id else to_w)
    db = AsyncMock()

    with pytest.raises(I18nError) as exc:
        await service.transfer_savings(db, user_id, from_id, to_id, Decimal("50"), "round_up", "tr")
    assert exc.value.key == "micro_savings.invalid_target_wallet"


@pytest.mark.asyncio
async def test_transfer_rejects_invalid_rule_key(service):
    user_id = uuid4()
    db = AsyncMock()
    with pytest.raises(I18nError) as exc:
        await service.transfer_savings(db, user_id, uuid4(), uuid4(), Decimal("10"), "unknown_rule", "tr")
    assert exc.value.key == "micro_savings.invalid_rule_key"


@pytest.mark.asyncio
async def test_transfer_rejects_oversized_amount(service):
    user_id = uuid4()
    db = AsyncMock()
    with pytest.raises(I18nError) as exc:
        await service.transfer_savings(
            db, user_id, uuid4(), uuid4(),
            MAX_MICRO_SAVINGS_TRANSFER + Decimal("1"),
            "coffee", "tr",
        )
    assert exc.value.key == "micro_savings.transfer_too_large"
