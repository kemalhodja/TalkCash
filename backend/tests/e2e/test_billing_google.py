import pytest
from httpx import AsyncClient
from unittest.mock import patch

from app.config import settings


@pytest.mark.asyncio
async def test_billing_products(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v1/billing/products", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["package_name"] == "io.talkcash.app"
    assert len(body["products"]) == 3
    assert body["products"][0]["product_id"].startswith("talkcash_")


@pytest.mark.asyncio
async def test_google_verify_mock(client: AsyncClient, auth_headers):
    with patch.object(settings, "google_play_verify_mock", True):
        resp = await client.post(
            "/api/v1/billing/google/verify",
            headers=auth_headers,
            json={
                "product_id": "talkcash_pro_monthly",
                "purchase_token": "mock-token-abc123",
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"]["plan"] == "pro"
        assert body["status"]["is_premium"] is True

        status = await client.get("/api/v1/billing/me", headers=auth_headers)
        assert status.json()["plan"] == "pro"


@pytest.mark.asyncio
async def test_google_verify_rejects_invalid_product(client: AsyncClient, auth_headers):
    with patch.object(settings, "google_play_verify_mock", True):
        resp = await client.post(
            "/api/v1/billing/google/verify",
            headers=auth_headers,
            json={
                "product_id": "invalid_sku",
                "purchase_token": "mock-token",
            },
        )
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_google_purchase_token_claimed_by_other_user(client: AsyncClient):
    with patch.object(settings, "google_play_verify_mock", True):
        first = await client.post("/api/v1/auth/register", json={
            "email": "google-bill-a@talkcash.io",
            "password": "testpass123",
            "full_name": "A",
        })
        second = await client.post("/api/v1/auth/register", json={
            "email": "google-bill-b@talkcash.io",
            "password": "testpass123",
            "full_name": "B",
        })
        headers_a = {"Authorization": f"Bearer {first.json()['access_token']}"}
        headers_b = {"Authorization": f"Bearer {second.json()['access_token']}"}

        token = "shared-mock-token"
        ok = await client.post(
            "/api/v1/billing/google/verify",
            headers=headers_a,
            json={"product_id": "talkcash_family_monthly", "purchase_token": token},
        )
        assert ok.status_code == 200

        conflict = await client.post(
            "/api/v1/billing/google/verify",
            headers=headers_b,
            json={"product_id": "talkcash_family_monthly", "purchase_token": token},
        )
        assert conflict.status_code == 400


@pytest.mark.asyncio
async def test_verify_premium_status_rejects_free_user(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v1/billing/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_premium"] is False

    blocked = await client.get("/api/v1/billing/premium-check", headers=auth_headers)
    assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_verify_premium_status_allows_pro_user(client: AsyncClient, auth_headers):
    with patch.object(settings, "google_play_verify_mock", True):
        upgrade = await client.post(
            "/api/v1/billing/google/verify",
            headers=auth_headers,
            json={"product_id": "talkcash_pro_monthly", "purchase_token": "premium-check-token"},
        )
        assert upgrade.status_code == 200

        ok = await client.get("/api/v1/billing/premium-check", headers=auth_headers)
        assert ok.status_code == 200
        assert ok.json()["is_premium"] is True
