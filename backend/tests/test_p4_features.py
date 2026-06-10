from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.schemas.sync import SyncOperation
from app.services.ocr.service import OCRService
from app.services.ocr.vision import google_vision_text
from app.services.sync.service import SyncService


@pytest.mark.asyncio
async def test_google_vision_ocr_mock():
    fake_resp = MagicMock()
    fake_resp.raise_for_status = MagicMock()
    fake_resp.json.return_value = {
        "responses": [{"textAnnotations": [{"description": "MIGROS\nTOPLAM 125.50"}]}],
    }
    with patch("app.services.ocr.vision.settings") as mock_settings:
        mock_settings.google_vision_api_key = "test-key"
        with patch("httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=None)
            instance.post = AsyncMock(return_value=fake_resp)
            mock_client.return_value = instance
            text = await google_vision_text(b"fake-image")
    assert "MIGROS" in text


@pytest.mark.asyncio
async def test_ocr_auto_prefers_tesseract_when_rich():
    ocr = OCRService()
    with patch.object(ocr, "_tesseract_ocr", return_value="MIGROS MARKET\nTOPLAM 99.90 TL"):
        with patch("app.services.ocr.service.settings") as mock_settings:
            mock_settings.ocr_provider = "auto"
            result = await ocr.extract_receipt_data(b"img", locale="tr")
    assert result["ocr_engine"] == "tesseract"


@pytest.mark.asyncio
async def test_sync_shopping_complete_conflict():
    service = SyncService()
    user_id = uuid4()
    item_id = uuid4()
    op_id = uuid4()

    item = MagicMock()
    item.id = item_id
    item.user_id = user_id
    item.name = "Süt"
    item.is_completed = True
    item.completed_at = datetime.utcnow()
    item.created_at = datetime.utcnow() - timedelta(days=1)

    db = AsyncMock()
    db.get = AsyncMock(return_value=item)

    op = SyncOperation(
        id=op_id,
        type="shopping_complete",
        payload={"item_id": str(item_id), "price": 30},
        client_timestamp=datetime.utcnow() - timedelta(hours=2),
    )

    with patch.object(service, "_get_cached_result", AsyncMock(return_value=None)):
        result, conflict = await service._process_operation(db, user_id, op, "tr")

    assert result is None
    assert conflict is not None
    assert conflict.type == "shopping_complete"


@pytest.mark.asyncio
async def test_sync_idempotency_cache():
    service = SyncService()
    user_id = uuid4()
    op_id = uuid4()

    with patch.object(service, "_get_cached_result", AsyncMock(return_value={"ok": True})):
        resp = await service.push(db=AsyncMock(), user_id=user_id, operations=[
            SyncOperation(
                id=op_id, type="shopping_add",
                payload={"items": ["ekmek"]},
                client_timestamp=datetime.utcnow(),
            ),
        ])
    assert resp.applied[0]["status"] == "duplicate"
