import enum

import uuid

from datetime import datetime



from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint

from sqlalchemy.dialects.postgresql import UUID

from sqlalchemy.orm import Mapped, mapped_column, relationship



from app.database import Base, pg_enum





class PlanTier(str, enum.Enum):

    FREE = "free"

    PRO = "pro"

    FAMILY = "family"

    BUSINESS = "business"





class SubscriptionStatus(str, enum.Enum):

    INACTIVE = "inactive"

    ACTIVE = "active"

    TRIALING = "trialing"

    CANCELED = "canceled"

    EXPIRED = "expired"

    GRACE_PERIOD = "grace_period"

    PAST_DUE = "past_due"





class SubscriptionPlan(Base):

    __tablename__ = "subscription_plans"



    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    key: Mapped[PlanTier] = mapped_column(pg_enum(PlanTier), unique=True, index=True)

    name: Mapped[str] = mapped_column(String(100))

    monthly_price_cents: Mapped[int] = mapped_column(Integer, default=0)

    currency: Mapped[str] = mapped_column(String(10), default="TRY")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)



    entitlements = relationship("Entitlement", back_populates="plan", cascade="all, delete-orphan")





class Entitlement(Base):

    __tablename__ = "entitlements"

    __table_args__ = (UniqueConstraint("plan_id", "key", name="uq_entitlement_plan_key"),)



    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subscription_plans.id", ondelete="CASCADE"))

    key: Mapped[str] = mapped_column(String(100), index=True)

    limit_value: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)



    plan = relationship("SubscriptionPlan", back_populates="entitlements")





class Subscription(Base):

    __tablename__ = "subscriptions"

    __table_args__ = (UniqueConstraint("purchase_token", name="uq_subscription_purchase_token"),)



    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)

    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"))



    status: Mapped[SubscriptionStatus] = mapped_column(

        pg_enum(SubscriptionStatus),

        default=SubscriptionStatus.INACTIVE,

    )



    google_product_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    purchase_token: Mapped[str | None] = mapped_column(String(512), nullable=True)



    start_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    expire_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)



    provider: Mapped[str] = mapped_column(String(50), default="internal")

    provider_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)



    plan = relationship("SubscriptionPlan")

    user = relationship("User", back_populates="subscription")



    @property

    def is_premium(self) -> bool:

        if self.status not in (

            SubscriptionStatus.ACTIVE,

            SubscriptionStatus.TRIALING,

            SubscriptionStatus.GRACE_PERIOD,

        ):

            return False

        plan = self.plan

        if plan is None:

            return False

        return plan.key != PlanTier.FREE





class UsageMeter(Base):

    __tablename__ = "usage_meters"

    __table_args__ = (UniqueConstraint("user_id", "entitlement_key", "period_key", name="uq_usage_user_key_period"),)



    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)

    entitlement_key: Mapped[str] = mapped_column(String(100), index=True)

    period_key: Mapped[str] = mapped_column(String(20), index=True)

    used: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)





class GooglePurchase(Base):

    __tablename__ = "google_purchases"

    __table_args__ = (UniqueConstraint("purchase_token", name="uq_google_purchase_token"),)



    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)

    product_id: Mapped[str] = mapped_column(String(120), index=True)

    purchase_token: Mapped[str] = mapped_column(String(512))

    order_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    plan_tier: Mapped[PlanTier] = mapped_column(pg_enum(PlanTier))

    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)





class BillingEvent(Base):

    __tablename__ = "billing_events"



    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    event_type: Mapped[str] = mapped_column(String(100), index=True)

    provider: Mapped[str] = mapped_column(String(50), default="internal")

    provider_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


