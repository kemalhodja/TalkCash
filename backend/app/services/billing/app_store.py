import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.config import settings
from app.models.billing import PlanTier
from app.services.billing.google_play import GOOGLE_PRODUCT_TO_TIER

logger = logging.getLogger(__name__)


@dataclass
class VerifiedApplePurchase:
    product_id: str
    receipt_data: str
    tier: PlanTier
    expires_at: datetime | None
    transaction_id: str | None


class AppStoreVerifier:
    def tier_for_product(self, product_id: str) -> PlanTier | None:
        return GOOGLE_PRODUCT_TO_TIER.get(product_id)

    def verify_subscription(
        self,
        product_id: str,
        receipt_data: str,
        transaction_id: str | None = None,
    ) -> VerifiedApplePurchase:
        tier = self.tier_for_product(product_id)
        if not tier:
            raise ValueError("billing.invalid_product")
        if not receipt_data or len(receipt_data) < 8:
            raise ValueError("billing.invalid_receipt")

        if settings.apple_verify_mock:
            days = 365 if "yearly" in product_id else 30
            digest = hashlib.sha256(receipt_data.encode()).hexdigest()[:24]
            return VerifiedApplePurchase(
                product_id=product_id,
                receipt_data=receipt_data,
                tier=tier,
                expires_at=datetime.utcnow() + timedelta(days=days),
                transaction_id=transaction_id or f"mock-ios-{digest}",
            )

        if not settings.apple_shared_secret.strip():
            raise ValueError("billing.apple_not_configured")

        # Production: wire App Store Server API / verifyReceipt here.
        raise ValueError("billing.apple_not_configured")
