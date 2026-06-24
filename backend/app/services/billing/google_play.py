import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.models.billing import PlanTier

logger = logging.getLogger(__name__)

GOOGLE_PRODUCT_TO_TIER: dict[str, PlanTier] = {
    "talkcash_pro_monthly": PlanTier.PRO,
    "talkcash_pro_yearly": PlanTier.PRO,
    "talkcash_family_monthly": PlanTier.FAMILY,
    "talkcash_family_yearly": PlanTier.FAMILY,
    "talkcash_business_monthly": PlanTier.BUSINESS,
    "talkcash_business_yearly": PlanTier.BUSINESS,
}

GOOGLE_PRODUCT_CATALOG: list[dict] = [
    {"product_id": "talkcash_pro_monthly", "plan": PlanTier.PRO.value, "name": "TalkCash Pro", "period": "monthly"},
    {"product_id": "talkcash_pro_yearly", "plan": PlanTier.PRO.value, "name": "TalkCash Pro", "period": "yearly"},
    {"product_id": "talkcash_family_monthly", "plan": PlanTier.FAMILY.value, "name": "TalkCash Family", "period": "monthly"},
    {"product_id": "talkcash_family_yearly", "plan": PlanTier.FAMILY.value, "name": "TalkCash Family", "period": "yearly"},
    {"product_id": "talkcash_business_monthly", "plan": PlanTier.BUSINESS.value, "name": "TalkCash Business", "period": "monthly"},
    {"product_id": "talkcash_business_yearly", "plan": PlanTier.BUSINESS.value, "name": "TalkCash Business", "period": "yearly"},
]


@dataclass
class VerifiedGooglePurchase:
    product_id: str
    purchase_token: str
    tier: PlanTier
    expires_at: datetime | None
    order_id: str | None


class GooglePlayVerifier:
    def product_catalog(self) -> list[dict]:
        return GOOGLE_PRODUCT_CATALOG

    def tier_for_product(self, product_id: str) -> PlanTier | None:
        return GOOGLE_PRODUCT_TO_TIER.get(product_id)

    def verify_subscription(self, product_id: str, purchase_token: str) -> VerifiedGooglePurchase:
        tier = self.tier_for_product(product_id)
        if not tier:
            raise ValueError("billing.invalid_product")

        if settings.google_play_verify_mock:
            days = 365 if "yearly" in product_id else 30
            return VerifiedGooglePurchase(
                product_id=product_id,
                purchase_token=purchase_token,
                tier=tier,
                expires_at=datetime.utcnow() + timedelta(days=days),
                order_id=f"mock-{purchase_token[:12]}",
            )

        if not settings.google_play_service_account_json.strip():
            raise ValueError("billing.google_not_configured")

        result = self._call_google_api(product_id, purchase_token)
        payment_state = int(result.get("paymentState", 0))
        if payment_state not in (1, 2):
            raise ValueError("billing.purchase_not_active")

        expiry_ms = result.get("expiryTimeMillis")
        expires_at = None
        if expiry_ms:
            expires_at = datetime.fromtimestamp(int(expiry_ms) / 1000, tz=timezone.utc).replace(tzinfo=None)
            if expires_at <= datetime.utcnow():
                raise ValueError("billing.purchase_expired")

        return VerifiedGooglePurchase(
            product_id=product_id,
            purchase_token=purchase_token,
            tier=tier,
            expires_at=expires_at,
            order_id=result.get("orderId"),
        )

    def _call_google_api(self, product_id: str, purchase_token: str) -> dict:
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise ValueError("billing.google_not_configured") from exc

        info = json.loads(settings.google_play_service_account_json)
        credentials = service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/androidpublisher"],
        )
        service = build("androidpublisher", "v3", credentials=credentials, cache_discovery=False)
        request = (
            service.purchases()
            .subscriptions()
            .get(
                packageName=settings.google_play_package_name,
                subscriptionId=product_id,
                token=purchase_token,
            )
        )
        return request.execute()
