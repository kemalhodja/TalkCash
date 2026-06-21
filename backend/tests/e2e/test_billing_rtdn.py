import pytest
from httpx import AsyncClient
from unittest.mock import patch

from app.config import settings


@pytest.mark.asyncio
async def test_google_rtdn_grace_period(client: AsyncClient, auth_headers):
    with patch.object(settings, "google_play_verify_mock", True), patch.object(
        settings, "google_rtdn_webhook_secret", "rtdn-test-secret"
    ):
        token = "rtdn-grace-token"
        await client.post(
            "/api/v1/billing/google/verify",
            headers=auth_headers,
            json={"product_id": "talkcash_pro_monthly", "purchase_token": token},
        )
        resp = await client.post(
            "/api/v1/billing/google/rtdn",
            headers={**auth_headers, "X-RTDN-Secret": "rtdn-test-secret"},
            json={
                "purchase_token": token,
                "product_id": "talkcash_pro_monthly",
                "notification_type": "SUBSCRIPTION_IN_GRACE_PERIOD",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["subscription_status"] == "grace_period"


@pytest.mark.asyncio
async def test_google_rtdn_expire(client: AsyncClient, auth_headers):
    with patch.object(settings, "google_play_verify_mock", True), patch.object(
        settings, "google_rtdn_webhook_secret", "rtdn-test-secret"
    ):
        token = "rtdn-expire-token"
        await client.post(
            "/api/v1/billing/google/verify",
            headers=auth_headers,
            json={"product_id": "talkcash_pro_monthly", "purchase_token": token},
        )
        resp = await client.post(
            "/api/v1/billing/google/rtdn",
            headers={**auth_headers, "X-RTDN-Secret": "rtdn-test-secret"},
            json={
                "purchase_token": token,
                "product_id": "talkcash_pro_monthly",
                "notification_type": "SUBSCRIPTION_EXPIRED",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "expired"

        me = await client.get("/api/v1/billing/me", headers=auth_headers)
        assert me.json()["is_premium"] is False
