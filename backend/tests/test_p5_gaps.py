from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.export.pdf_service import PDFExportService
from app.services.ocr.service import OCRService
from app.services.social.shared_wallet_service import SharedWalletService


def test_ocr_verify_different_amounts():
    ocr = OCRService()
    assert ocr.verify_transaction(Decimal("150"), Decimal("149.50")) is True
    assert ocr.verify_transaction(Decimal("150"), Decimal("120")) is False


def test_pdf_includes_category_chart():
    service = PDFExportService()
    content = service.generate_report(
        "User", Decimal("1000"), [], [], [],
        {"Market": 500, "Kahve": 200},
        locale="tr",
    )
    assert content[:4] == b"%PDF"


@pytest.mark.asyncio
async def test_shared_wallet_member_check():
    svc = SharedWalletService()
    wallet_id = uuid4()
    user_id = uuid4()
    wallet = MagicMock()
    wallet.member_ids = f'["{user_id}"]'
    db = AsyncMock()
    db.get = AsyncMock(return_value=wallet)
    assert await svc.is_member(db, wallet_id, user_id) is True
    assert await svc.is_member(db, wallet_id, uuid4()) is False


@pytest.mark.asyncio
async def test_input_capabilities_route():
    from unittest.mock import MagicMock
    from app.routers.input import input_capabilities
    user = MagicMock()
    with patch("app.config.settings") as mock_settings:
        mock_settings.openai_api_key = ""
        mock_settings.google_vision_api_key = ""
        result = await input_capabilities(user)
    assert result["voice_available"] is False
    assert result["ocr_tesseract"] is True
