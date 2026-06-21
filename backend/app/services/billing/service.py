from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.billing import (
    BillingEvent,
    Entitlement,
    GooglePurchase,
    PlanTier,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    UsageMeter,
)
from app.schemas.billing import EntitlementStatus, PremiumStatusResponse
from app.services.audit.service import AuditService
from app.services.billing.google_play import GooglePlayVerifier, VerifiedGooglePurchase


DEFAULT_PLAN_CONFIG: dict[PlanTier, dict] = {
    PlanTier.FREE: {
        "name": "TalkCash Free",
        "price": 0,
        "entitlements": {
            "basic_finance": None,
            "receipt_ocr": 5,
            "ai_coach": 10,
            "advanced_reports": 0,
            "shared_workspace": 0,
            "price_watch": 3,
            "swap_nudges": 3,
            "portfolio_coach": 0,
        },
    },
    PlanTier.PRO: {
        "name": "TalkCash Pro",
        "price": 9999,
        "entitlements": {
            "basic_finance": None,
            "receipt_ocr": None,
            "ai_coach": 250,
            "advanced_reports": None,
            "shared_workspace": 1,
            "price_watch": 50,
            "swap_nudges": None,
            "portfolio_coach": None,
        },
    },
    PlanTier.FAMILY: {
        "name": "TalkCash Family",
        "price": 16999,
        "entitlements": {
            "basic_finance": None,
            "receipt_ocr": None,
            "ai_coach": 500,
            "advanced_reports": None,
            "shared_workspace": 3,
            "family_controls": None,
            "price_watch": 100,
            "swap_nudges": None,
            "portfolio_coach": None,
        },
    },
    PlanTier.BUSINESS: {
        "name": "TalkCash Business",
        "price": 29999,
        "entitlements": {
            "basic_finance": None,
            "receipt_ocr": None,
            "ai_coach": 1000,
            "advanced_reports": None,
            "shared_workspace": 10,
            "business_reports": None,
            "price_watch": None,
            "swap_nudges": None,
            "portfolio_coach": None,
        },
    },
}

DAILY_ENTITLEMENT_KEYS = frozenset({"swap_nudges"})


class EntitlementError(Exception):
    def __init__(self, key: str):
        self.key = key
        super().__init__(key)


class PremiumRequiredError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


class BillingService:
    def __init__(self):
        self.audit = AuditService()
        self.google_play = GooglePlayVerifier()

    def period_key(self) -> str:
        return datetime.utcnow().strftime("%Y-%m")

    def daily_period_key(self) -> str:
        return datetime.utcnow().strftime("%Y-%m-%d")

    def _period_key_for_entitlement(self, key: str) -> str:
        return self.daily_period_key() if key in DAILY_ENTITLEMENT_KEYS else self.period_key()

    async def ensure_default_plans(self, db: AsyncSession) -> None:
        result = await db.execute(select(SubscriptionPlan).options(selectinload(SubscriptionPlan.entitlements)))
        existing = {plan.key: plan for plan in result.scalars().all()}
        changed = False

        for tier, config in DEFAULT_PLAN_CONFIG.items():
            plan = existing.get(tier)
            if not plan:
                plan = SubscriptionPlan(
                    key=tier,
                    name=config["name"],
                    monthly_price_cents=config["price"],
                    currency="TRY",
                )
                db.add(plan)
                await db.flush()
                existing[tier] = plan
                changed = True
                for key, limit in config["entitlements"].items():
                    db.add(Entitlement(plan_id=plan.id, key=key, limit_value=limit))
                continue

            if plan.name != config["name"] or plan.monthly_price_cents != config["price"]:
                plan.name = config["name"]
                plan.monthly_price_cents = config["price"]
                changed = True

            current = {ent.key: ent for ent in plan.entitlements}
            for key, limit in config["entitlements"].items():
                if key not in current:
                    db.add(Entitlement(plan_id=plan.id, key=key, limit_value=limit))
                    changed = True
                elif current[key].limit_value != limit:
                    current[key].limit_value = limit
                    changed = True

        if changed:
            await db.commit()

    async def _plan_by_tier(self, db: AsyncSession, tier: PlanTier) -> SubscriptionPlan:
        await self.ensure_default_plans(db)
        result = await db.execute(
            select(SubscriptionPlan)
            .options(selectinload(SubscriptionPlan.entitlements))
            .where(SubscriptionPlan.key == tier)
        )
        plan = result.scalars().first()
        if not plan:
            raise ValueError("billing.plan_not_found")
        return plan

    async def _plan_by_id(self, db: AsyncSession, plan_id: UUID) -> SubscriptionPlan:
        result = await db.execute(
            select(SubscriptionPlan)
            .options(selectinload(SubscriptionPlan.entitlements))
            .where(SubscriptionPlan.id == plan_id)
        )
        plan = result.scalars().first()
        if not plan:
            raise ValueError("billing.plan_not_found")
        return plan

    async def get_subscription(self, db: AsyncSession, user_id: UUID) -> Subscription:
        await self.ensure_default_plans(db)
        result = await db.execute(
            select(Subscription)
            .options(selectinload(Subscription.plan).selectinload(SubscriptionPlan.entitlements))
            .where(Subscription.user_id == user_id)
        )
        subscription = result.scalars().first()
        if subscription:
            await self._maybe_expire_subscription(db, subscription)
            return subscription

        free_plan = await self._plan_by_tier(db, PlanTier.FREE)
        subscription = Subscription(
            user_id=user_id,
            plan_id=free_plan.id,
            status=SubscriptionStatus.INACTIVE,
            start_date=datetime.utcnow(),
        )
        db.add(subscription)
        db.add(BillingEvent(user_id=user_id, event_type="subscription.created", provider="internal"))
        await self.audit.log(
            db,
            actor_user_id=user_id,
            action="billing.subscription_created",
            resource_type="subscription",
            metadata={"plan": PlanTier.FREE.value},
        )
        await db.commit()
        await db.refresh(subscription)
        return subscription

    async def get_status(self, db: AsyncSession, user_id: UUID) -> PremiumStatusResponse:
        subscription = await self.get_subscription(db, user_id)
        plan = await self._plan_by_id(db, subscription.plan_id)
        usage = await self._usage_for_period(db, user_id)
        daily_usage = await self._usage_for_daily_period(db, user_id)
        entitlements: dict[str, EntitlementStatus] = {}
        for ent in plan.entitlements:
            used = daily_usage.get(ent.key, usage.get(ent.key, 0)) if ent.key in DAILY_ENTITLEMENT_KEYS else usage.get(ent.key, 0)
            limit = ent.limit_value
            enabled = limit is None or limit > 0
            remaining = None if limit is None else max(limit - used, 0)
            entitlements[ent.key] = EntitlementStatus(
                enabled=enabled,
                limit=limit,
                used=used,
                remaining=remaining,
            )
        return PremiumStatusResponse(
            plan=plan.key,
            status=subscription.status,
            is_premium=(
                plan.key != PlanTier.FREE
                and subscription.status
                in (
                    SubscriptionStatus.ACTIVE,
                    SubscriptionStatus.TRIALING,
                    SubscriptionStatus.GRACE_PERIOD,
                )
            ),
            entitlements=entitlements,
        )

    async def _usage_for_period(self, db: AsyncSession, user_id: UUID) -> dict[str, int]:
        result = await db.execute(
            select(UsageMeter).where(
                UsageMeter.user_id == user_id,
                UsageMeter.period_key == self.period_key(),
            )
        )
        return {row.entitlement_key: row.used for row in result.scalars().all()}

    async def _usage_for_daily_period(self, db: AsyncSession, user_id: UUID) -> dict[str, int]:
        result = await db.execute(
            select(UsageMeter).where(
                UsageMeter.user_id == user_id,
                UsageMeter.period_key == self.daily_period_key(),
            )
        )
        return {row.entitlement_key: row.used for row in result.scalars().all()}

    async def require_entitlement(self, db: AsyncSession, user_id: UUID, key: str, amount: int = 0) -> None:
        status = await self.get_status(db, user_id)
        ent = status.entitlements.get(key)
        if not ent or not ent.enabled:
            raise EntitlementError(key)
        if ent.limit is not None and ent.used + amount > ent.limit:
            raise EntitlementError(key)

    async def consume_usage(self, db: AsyncSession, user_id: UUID, key: str, amount: int = 1) -> UsageMeter:
        await self.require_entitlement(db, user_id, key, amount)
        period = self.period_key()
        result = await db.execute(
            select(UsageMeter).where(
                UsageMeter.user_id == user_id,
                UsageMeter.entitlement_key == key,
                UsageMeter.period_key == period,
            )
        )
        meter = result.scalars().first()
        if not meter:
            meter = UsageMeter(user_id=user_id, entitlement_key=key, period_key=period, used=0)
            db.add(meter)
        meter.used += amount
        db.add(BillingEvent(user_id=user_id, event_type=f"usage.{key}", provider="internal"))
        await db.commit()
        await db.refresh(meter)
        return meter

    async def consume_daily_usage(self, db: AsyncSession, user_id: UUID, key: str, amount: int = 1) -> UsageMeter:
        if key not in DAILY_ENTITLEMENT_KEYS:
            return await self.consume_usage(db, user_id, key, amount)
        await self.require_entitlement(db, user_id, key, amount)
        period = self.daily_period_key()
        result = await db.execute(
            select(UsageMeter).where(
                UsageMeter.user_id == user_id,
                UsageMeter.entitlement_key == key,
                UsageMeter.period_key == period,
            )
        )
        meter = result.scalars().first()
        if not meter:
            meter = UsageMeter(user_id=user_id, entitlement_key=key, period_key=period, used=0)
            db.add(meter)
        meter.used += amount
        db.add(BillingEvent(user_id=user_id, event_type=f"usage.daily.{key}", provider="internal"))
        await db.commit()
        await db.refresh(meter)
        return meter

    async def verify_premium_status(self, db: AsyncSession, user_id: UUID) -> Subscription:
        subscription = await self.get_subscription(db, user_id)
        if subscription.status == SubscriptionStatus.EXPIRED:
            raise PremiumRequiredError("subscription_expired")

        plan = await self._plan_by_id(db, subscription.plan_id)
        subscription.plan = plan

        if not subscription.is_premium:
            raise PremiumRequiredError("premium_required")

        return subscription

    async def _maybe_expire_subscription(self, db: AsyncSession, subscription: Subscription) -> None:
        if not subscription.expire_date or subscription.expire_date > datetime.utcnow():
            return
        await self._expire_subscription(db, subscription)

    async def _expire_subscription(self, db: AsyncSession, subscription: Subscription) -> None:
        provider = subscription.provider
        free_plan = await self._plan_by_tier(db, PlanTier.FREE)
        subscription.plan_id = free_plan.id
        subscription.status = SubscriptionStatus.EXPIRED
        subscription.provider = "internal"
        subscription.google_product_id = None
        subscription.purchase_token = None
        subscription.expire_date = None
        db.add(
            BillingEvent(
                user_id=subscription.user_id,
                event_type="subscription.expired",
                provider=provider,
            )
        )
        await db.commit()

    async def set_internal_plan(self, db: AsyncSession, user_id: UUID, tier: PlanTier) -> Subscription:
        plan = await self._plan_by_tier(db, tier)
        subscription = await self.get_subscription(db, user_id)
        subscription.plan_id = plan.id
        subscription.status = SubscriptionStatus.ACTIVE if tier != PlanTier.FREE else SubscriptionStatus.INACTIVE
        subscription.provider = "internal"
        subscription.google_product_id = None
        subscription.purchase_token = None
        subscription.expire_date = None
        if tier != PlanTier.FREE:
            subscription.start_date = datetime.utcnow()
        db.add(BillingEvent(user_id=user_id, event_type="subscription.plan_changed", provider="internal"))
        await self.audit.log(
            db,
            actor_user_id=user_id,
            action="billing.plan_changed",
            resource_type="subscription",
            resource_id=str(subscription.id),
            metadata={"plan": tier.value},
        )
        await db.commit()
        await db.refresh(subscription)
        return subscription

    async def activate_google_subscription(
        self,
        db: AsyncSession,
        user_id: UUID,
        verified: VerifiedGooglePurchase,
    ) -> Subscription:
        existing = await db.execute(
            select(GooglePurchase).where(GooglePurchase.purchase_token == verified.purchase_token)
        )
        purchase_row = existing.scalars().first()
        token_owner = await db.execute(
            select(Subscription).where(Subscription.purchase_token == verified.purchase_token)
        )
        token_sub = token_owner.scalars().first()
        if purchase_row and purchase_row.user_id != user_id:
            raise ValueError("billing.purchase_already_claimed")
        if token_sub and token_sub.user_id != user_id:
            raise ValueError("billing.purchase_already_claimed")

        plan = await self._plan_by_tier(db, verified.tier)
        subscription = await self.get_subscription(db, user_id)
        subscription.plan_id = plan.id
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.provider = "google_play"
        subscription.google_product_id = verified.product_id
        subscription.purchase_token = verified.purchase_token
        subscription.expire_date = verified.expires_at
        subscription.start_date = datetime.utcnow()

        if purchase_row:
            purchase_row.user_id = user_id
            purchase_row.product_id = verified.product_id
            purchase_row.plan_tier = verified.tier
            purchase_row.order_id = verified.order_id
            purchase_row.expires_at = verified.expires_at
            purchase_row.updated_at = datetime.utcnow()
        else:
            db.add(
                GooglePurchase(
                    user_id=user_id,
                    product_id=verified.product_id,
                    purchase_token=verified.purchase_token,
                    order_id=verified.order_id,
                    plan_tier=verified.tier,
                    expires_at=verified.expires_at,
                )
            )

        db.add(
            BillingEvent(
                user_id=user_id,
                event_type="subscription.google_activated",
                provider="google_play",
                provider_event_id=verified.order_id,
            )
        )
        await self.audit.log(
            db,
            actor_user_id=user_id,
            action="billing.google_activated",
            resource_type="subscription",
            resource_id=str(subscription.id),
            metadata={"plan": verified.tier.value, "product_id": verified.product_id},
        )
        await db.commit()
        await db.refresh(subscription)
        return subscription

    def google_product_catalog(self) -> list[dict]:
        return self.google_play.product_catalog()
