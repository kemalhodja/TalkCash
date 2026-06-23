from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.billing import PlanTier, SubscriptionStatus
from app.services.billing.service import BillingService


@pytest.mark.asyncio
async def test_open_access_status_for_all_users():
    billing = BillingService()
    db = AsyncMock()
    plan = MagicMock()
    plan.key = PlanTier.PRO
    plan.entitlements = [
        MagicMock(key="ai_coach", limit_value=250),
        MagicMock(key="portfolio_coach", limit_value=None),
    ]

    with patch("app.services.billing.service.settings") as mock_settings:
        mock_settings.billing_premium_unlocked = True
        with patch.object(billing, "_plan_by_tier", new_callable=AsyncMock, return_value=plan):
            status = await billing.get_status(db, MagicMock())

    assert status.plan == PlanTier.PRO
    assert status.is_premium is True
    assert status.entitlements["ai_coach"].limit is None
    assert status.entitlements["ai_coach"].remaining is None


@pytest.mark.asyncio
async def test_require_entitlement_skipped_when_unlocked():
    billing = BillingService()
    with patch("app.services.billing.service.settings") as mock_settings:
        mock_settings.billing_premium_unlocked = True
        await billing.require_entitlement(AsyncMock(), MagicMock(), "portfolio_coach", 1)
