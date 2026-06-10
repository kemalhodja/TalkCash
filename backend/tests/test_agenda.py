from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.agenda.service import AgendaService
from app.models.agenda import AgendaStatus


@pytest.mark.asyncio
async def test_mark_paid_deducts_from_default_wallet():
    user_id = uuid4()
    wallet_id = uuid4()
    db = AsyncMock()
    item = MagicMock()
    item.title = "Elektrik"
    item.amount = Decimal("250")
    item.status = AgendaStatus.PENDING
    item.is_recurring = False
    item.due_date = datetime.utcnow()

    service = AgendaService()
    with patch.object(service, "_resolve_wallet", AsyncMock(return_value=wallet_id)):
        with patch.object(service.wallet_service, "add_expense", AsyncMock()) as expense_mock:
            mock_result = MagicMock()
            mock_result.scalars.return_value.first.return_value = item
            db.execute = AsyncMock(return_value=mock_result)
            result = await service.mark_paid(db, user_id, "Elektrik", None, deduct_wallet=True)
            expense_mock.assert_awaited_once()
            assert result.status == AgendaStatus.PAID
