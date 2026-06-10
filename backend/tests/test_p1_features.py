from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.agenda import AgendaStatus
from app.services.nlp.turkish_parser import extract_paid_bill_title


def test_extract_paid_bill_title():
    assert "elektrik" in extract_paid_bill_title("elektrik faturasını ödedim").lower()
    title = extract_paid_bill_title("internet faturasını bankadan ödedim")
    assert "internet" in title.lower()
    assert "banka" not in title.lower()


@pytest.mark.asyncio
async def test_settle_debt_marks_agenda():
    from app.services.social.service import SocialService

    user_id = uuid4()
    debt_id = uuid4()
    db = AsyncMock()
    record = MagicMock()
    record.user_id = user_id
    record.person_name = "Ali"
    record.is_settled = False

    db.get = AsyncMock(return_value=record)
    service = SocialService()

    with patch("app.services.agenda.service.AgendaService") as agenda_cls:
        agenda_mock = agenda_cls.return_value
        agenda_mock.mark_paid = AsyncMock()
        await service.settle_debt(db, user_id, debt_id)
        agenda_mock.mark_paid.assert_awaited_once_with(db, user_id, "Ali", deduct_wallet=False)

    assert record.is_settled is True


@pytest.mark.asyncio
async def test_budget_notify_after_expense():
    from app.services.budget_notify import push_budget_alerts_after_expense

    user_id = uuid4()
    db = AsyncMock()
    user = MagicMock()
    user.push_token = "token"
    db.get = AsyncMock(return_value=user)

    with patch("app.services.budget_notify.ai_service") as ai_mock:
        ai_mock.check_budget_alerts = AsyncMock(return_value=[
            {"type": "budget_warning", "category": "Kahve", "message": "80% warning"},
        ])
        with patch("app.services.budget_notify.notif_service") as notif_mock:
            notif_mock.create_in_app = AsyncMock()
            notif_mock.send_push = AsyncMock(return_value=True)
            sent = await push_budget_alerts_after_expense(db, user_id, "Kahve", "tr")

    assert sent == 1
    notif_mock.send_push.assert_awaited_once()


@pytest.mark.asyncio
async def test_fetch_gold_rate_from_truncgil():
    from app.services.exchange.service import ExchangeService

    service = ExchangeService()
    mock_data = {"GRA": {"Selling": 6120.5, "Type": "Gold", "Name": "GRAMALTIN"}}
    with patch("httpx.AsyncClient") as mock_client:
        instance = AsyncMock()
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=None)
        resp = MagicMock()
        resp.json = MagicMock(return_value=mock_data)
        instance.get = AsyncMock(return_value=resp)
        mock_client.return_value = instance
        rate = await service._fetch_gold_try_per_gram()

    assert rate == Decimal("6120.5")
