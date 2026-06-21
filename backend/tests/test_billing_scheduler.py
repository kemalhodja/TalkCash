from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.billing import PlanTier, Subscription, SubscriptionPlan, SubscriptionStatus
from app.models.user import User
from app.services.billing_scheduler import daily_premium_subscription_scan


def _make_plan(tier: PlanTier) -> SubscriptionPlan:
    return SubscriptionPlan(id=uuid4(), key=tier, name=f"TalkCash {tier.value.title()}", monthly_price_cents=1000)


@pytest.mark.asyncio
async def test_premium_scan_sends_three_day_reminder():
    user = User(id=uuid4(), email="premium@talkcash.io", locale="tr", push_token="ExponentPushToken[test]")
    plan = _make_plan(PlanTier.PRO)
    subscription = Subscription(
        id=uuid4(),
        user_id=user.id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE,
        expire_date=datetime.utcnow() + timedelta(days=3),
        plan=plan,
    )
    db = AsyncMock()
    rows = MagicMock()
    rows.all.return_value = [(subscription, user)]
    db.execute = AsyncMock(return_value=rows)

    with (
        patch("app.services.billing_scheduler._dedup", new_callable=AsyncMock, return_value=False),
        patch("app.services.billing_scheduler._notify_user", new_callable=AsyncMock) as notify_mock,
        patch("app.services.billing_scheduler.billing_service._expire_subscription", new_callable=AsyncMock),
    ):
        sent = await daily_premium_subscription_scan(db)

    assert sent == 1
    notify_mock.assert_awaited_once()
    assert notify_mock.await_args.args[4] == "premium_expiry_reminder"


@pytest.mark.asyncio
async def test_premium_scan_expires_due_subscription():
    user = User(id=uuid4(), email="expired@talkcash.io", locale="en")
    plan = _make_plan(PlanTier.PRO)
    subscription = Subscription(
        id=uuid4(),
        user_id=user.id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE,
        expire_date=datetime.utcnow() - timedelta(hours=1),
        plan=plan,
    )
    db = AsyncMock()
    rows = MagicMock()
    rows.all.return_value = [(subscription, user)]
    db.execute = AsyncMock(return_value=rows)

    with (
        patch("app.services.billing_scheduler._dedup", new_callable=AsyncMock, return_value=False),
        patch("app.services.billing_scheduler._notify_user", new_callable=AsyncMock) as notify_mock,
        patch("app.services.billing_scheduler.billing_service._expire_subscription", new_callable=AsyncMock) as expire_mock,
    ):
        sent = await daily_premium_subscription_scan(db)

    expire_mock.assert_awaited_once()
    notify_mock.assert_awaited_once()
    assert sent == 1
