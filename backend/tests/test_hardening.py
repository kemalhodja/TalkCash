import pytest
from decimal import Decimal
from uuid import uuid4

from app.i18n import I18nError
from app.models.wallet import Wallet, WalletType
from app.services.wallet.service import _ensure_can_spend


def test_password_schema_rejects_short():
    from pydantic import ValidationError
    from app.schemas.auth import RegisterRequest

    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="1234567")


def test_password_schema_rejects_digits_only():
    from pydantic import ValidationError
    from app.schemas.auth import RegisterRequest

    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="12345678")


def test_pin_schema_rejects_letters():
    from pydantic import ValidationError
    from app.schemas.auth import PinRequest

    with pytest.raises(ValidationError):
        PinRequest(pin="12ab")


def test_insufficient_funds_blocks_cash_wallet():
    wallet = Wallet(user_id=uuid4(), name="Nakit", wallet_type=WalletType.CASH, balance=Decimal("50"))
    with pytest.raises(I18nError) as exc:
        _ensure_can_spend(wallet, Decimal("100"))
    assert exc.value.key == "wallet.insufficient_funds"


def test_credit_card_allows_spend_without_balance_check():
    wallet = Wallet(user_id=uuid4(), name="Kredi", wallet_type=WalletType.CREDIT_CARD, balance=Decimal("0"))
    _ensure_can_spend(wallet, Decimal("500"))
