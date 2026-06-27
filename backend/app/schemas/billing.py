from uuid import UUID

from pydantic import BaseModel, Field

from app.models.billing import PlanTier, SubscriptionStatus


class EntitlementStatus(BaseModel):
    enabled: bool
    limit: int | None = None
    used: int = 0
    remaining: int | None = None


class PremiumStatusResponse(BaseModel):
    plan: PlanTier
    status: SubscriptionStatus
    is_premium: bool
    entitlements: dict[str, EntitlementStatus]


class UpgradeRequest(BaseModel):
    plan: PlanTier = Field(description="Target internal test plan")


class AdminUpgradeRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    plan: PlanTier = Field(default=PlanTier.PRO, description="Target internal test plan")


class UpgradeResponse(BaseModel):
    subscription_id: UUID
    status: PremiumStatusResponse


class GoogleVerifyRequest(BaseModel):
    product_id: str = Field(min_length=3, max_length=120)
    purchase_token: str = Field(min_length=10, max_length=512)


class GoogleVerifyResponse(BaseModel):
    subscription_id: UUID
    status: PremiumStatusResponse


class AppleVerifyRequest(BaseModel):
    product_id: str = Field(min_length=3, max_length=120)
    receipt_data: str = Field(min_length=8, max_length=8192)
    transaction_id: str | None = Field(default=None, max_length=120)


class AppleVerifyResponse(BaseModel):
    subscription_id: UUID
    status: PremiumStatusResponse


class ProductCatalogItem(BaseModel):
    product_id: str
    plan: PlanTier
    name: str


class ProductCatalogResponse(BaseModel):
    products: list[ProductCatalogItem]
    package_name: str
