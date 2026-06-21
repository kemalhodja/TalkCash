import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
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


def test_auth_schemas_normalize_email():
    from app.schemas.auth import LoginRequest, RegisterRequest

    assert RegisterRequest(email="USER@Example.COM ", password="Strong123!", full_name="A").email == "user@example.com"
    assert LoginRequest(email="USER@Example.COM ", password="x").email == "user@example.com"


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


@pytest.mark.asyncio
async def test_get_owned_wallet_rejects_other_user_wallet():
    from app.services.wallet.service import WalletService

    owner_id = uuid4()
    other_id = uuid4()
    wallet = Wallet(id=uuid4(), user_id=other_id, name="Banka", wallet_type=WalletType.BANK, balance=Decimal("10"))
    db = AsyncMock()
    db.get = AsyncMock(return_value=wallet)

    with pytest.raises(I18nError) as exc:
        await WalletService().get_owned_wallet(db, owner_id, wallet.id)

    assert exc.value.key == "wallet.not_found"


def test_ocr_max_upload_setting():
    from app.config import settings

    assert settings.ocr_max_upload_bytes == 10 * 1024 * 1024
    assert settings.voice_rate_limit == 20
    assert settings.ocr_rate_limit == 15


def test_storage_get_url_preserves_http():
    import asyncio
    from app.services.storage.service import StorageService

    svc = StorageService()
    url = asyncio.run(svc.get_url("https://cdn.example.com/receipt.jpg"))
    assert url == "https://cdn.example.com/receipt.jpg"


@pytest.mark.asyncio
async def test_storage_delete_removes_local_file(tmp_path):
    from app.services.storage.service import StorageService

    receipt = tmp_path / "receipt.jpg"
    receipt.write_bytes(b"fake-image")

    await StorageService().delete(str(receipt))

    assert not receipt.exists()


@pytest.mark.asyncio
async def test_wallet_alias_resolves_english_cash():
    from uuid import uuid4
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.wallet import Wallet, WalletType
    from app.services.wallet.service import WalletService

    service = WalletService()
    user_id = uuid4()
    wallet = Wallet(user_id=user_id, name="Nakit", wallet_type=WalletType.CASH, balance=Decimal("100"))
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.first.return_value = wallet
    db.execute = AsyncMock(return_value=result)

    found = await service.find_by_name(db, user_id, "Cash")
    assert found is wallet


def test_production_settings_rejects_weak_secret(monkeypatch):
    from app.config import settings
    from app.startup import validate_production_settings

    monkeypatch.setattr(settings, "debug", False)
    monkeypatch.setattr(settings, "secret_key", "change-me-in-production")
    monkeypatch.setattr(settings, "allowed_origins", "https://app.example.com")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_production_settings()


def test_production_settings_rejects_wildcard_cors(monkeypatch):
    from app.config import settings
    from app.startup import validate_production_settings

    monkeypatch.setattr(settings, "debug", False)
    monkeypatch.setattr(settings, "secret_key", "x" * 32)
    monkeypatch.setattr(settings, "allowed_origins", "*")
    with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS"):
        validate_production_settings()


@pytest.mark.asyncio
async def test_auth_rate_limit_strict_uses_memory_when_redis_down():
    from fastapi import HTTPException
    from unittest.mock import patch
    from app.utils import rate_limit
    from app.utils.rate_limit import check_rate_limit

    rate_limit._memory_windows.clear()
    request = MagicMock()
    request.client.host = "127.0.0.1"

    with patch("app.utils.rate_limit.get_redis", side_effect=ConnectionError("down")):
        with patch("app.utils.rate_limit.settings.rate_limit_enabled", True):
            for _ in range(3):
                await check_rate_limit(request, "auth-test", 3, strict=True)
            with pytest.raises(HTTPException) as exc:
                await check_rate_limit(request, "auth-test", 3, strict=True)
    assert exc.value.status_code == 429


def test_parse_positive_amount_rejects_negative():
    from app.utils.validation import parse_positive_amount
    with pytest.raises(ValueError):
        parse_positive_amount(-10)


def test_validate_image_rejects_non_image():
    from app.utils.validation import validate_image_bytes
    with pytest.raises(ValueError):
        validate_image_bytes(b"not-an-image", 1024)


def test_parsed_input_rejects_oversized_amount():
    from pydantic import ValidationError
    from app.schemas.common import ParsedInput

    with pytest.raises(ValidationError):
        ParsedInput(intent="add_expense", amount="9999999999999")
