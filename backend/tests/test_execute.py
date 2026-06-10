from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.routers.execute import _dispatch
from app.schemas.common import ParsedInput


@pytest.mark.asyncio
async def test_dispatch_add_bill():
    user_id = uuid4()
    db = AsyncMock()
    parsed = ParsedInput(intent="add_bill", amount=Decimal("250"), description="Elektrik")
    mock_item = MagicMock()
    mock_item.id = uuid4()
    mock_item.title = "Elektrik"

    with patch("app.routers.execute.agenda_service") as agenda_mock:
        agenda_mock.add_bill = AsyncMock(return_value=mock_item)
        result = await _dispatch(user_id, parsed, db, locale="tr")

    assert result["title"] == "Elektrik"
    assert "id" in result
    agenda_mock.add_bill.assert_awaited_once()


@pytest.mark.asyncio
async def test_dispatch_add_bill_requires_amount():
    user_id = uuid4()
    db = AsyncMock()
    parsed = ParsedInput(intent="add_bill", description="Elektrik")

    with pytest.raises(ValueError, match="Tutar belirlenemedi"):
        await _dispatch(user_id, parsed, db, locale="tr")


@pytest.mark.asyncio
async def test_dispatch_add_bill_amount_required_en():
    user_id = uuid4()
    db = AsyncMock()
    parsed = ParsedInput(intent="add_bill", description="Electric")

    with pytest.raises(ValueError, match="Amount could not be determined"):
        await _dispatch(user_id, parsed, db, locale="en")
