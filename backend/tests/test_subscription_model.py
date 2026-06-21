import pytest
from datetime import datetime

from app.models.billing import PlanTier, Subscription, SubscriptionStatus


def test_subscription_is_premium_active_pro():
    class Plan:
        key = PlanTier.PRO

    sub = Subscription(
        user_id=None,
        plan_id=None,
        status=SubscriptionStatus.ACTIVE,
        google_product_id="talkcash_pro_monthly",
        purchase_token="token",
        start_date=datetime.utcnow(),
    )
    sub.plan = Plan()
    assert sub.is_premium is True


def test_subscription_is_premium_inactive_free():
    class Plan:
        key = PlanTier.FREE

    sub = Subscription(
        user_id=None,
        plan_id=None,
        status=SubscriptionStatus.INACTIVE,
        start_date=datetime.utcnow(),
    )
    sub.plan = Plan()
    assert sub.is_premium is False


def test_subscription_is_premium_expired():
    class Plan:
        key = PlanTier.PRO

    sub = Subscription(
        user_id=None,
        plan_id=None,
        status=SubscriptionStatus.EXPIRED,
        start_date=datetime.utcnow(),
    )
    sub.plan = Plan()
    assert sub.is_premium is False
