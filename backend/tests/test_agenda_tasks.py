from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.agenda import AgendaItemType, AgendaStatus
from app.services.agenda.service import AgendaService


@pytest.mark.asyncio
async def test_add_task_has_no_amount():
    user_id = uuid4()
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock(side_effect=lambda item: item)

    service = AgendaService()
    item = await service.add_task(db, user_id, "Vergi dairesini ara", datetime.utcnow(), notes="09:00")

    assert item.item_type == AgendaItemType.TASK.value
    assert item.amount is None
    assert item.notes == "09:00"
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_mark_complete_sets_paid():
    user_id = uuid4()
    item_id = uuid4()
    db = AsyncMock()
    item = MagicMock()
    item.user_id = user_id
    item.status = AgendaStatus.PENDING
    db.get = AsyncMock(return_value=item)
    db.commit = AsyncMock()
    db.refresh = AsyncMock(side_effect=lambda x: x)

    service = AgendaService()
    result = await service.mark_complete(db, user_id, item_id)
    assert result.status == AgendaStatus.PAID
    assert item.paid_at is not None


@pytest.mark.asyncio
async def test_mark_paid_task_skips_wallet():
    user_id = uuid4()
    item = MagicMock()
    item.title = "Doktor randevusu"
    item.amount = None
    item.status = AgendaStatus.PENDING
    item.is_recurring = False
    item.item_type = AgendaItemType.TASK.value
    item.due_date = datetime.utcnow()

    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = item
    db.execute = AsyncMock(return_value=mock_result)

    service = AgendaService()
    with patch.object(service.wallet_service, "add_expense", AsyncMock()) as expense_mock:
        result = await service.mark_paid(db, user_id, "Doktor", deduct_wallet=True)
        expense_mock.assert_not_awaited()
        assert result.status == AgendaStatus.PAID
