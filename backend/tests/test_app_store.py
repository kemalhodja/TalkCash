"""App Store billing verifier (mock scaffold)."""

from app.services.billing.app_store import AppStoreVerifier


def test_app_store_mock_verify():
    verifier = AppStoreVerifier()
    verified = verifier.verify_subscription(
        "talkcash_pro_monthly",
        "fake-receipt-data-base64",
        "txn-123",
    )
    assert verified.tier.value == "pro"
    assert verified.transaction_id == "txn-123"
