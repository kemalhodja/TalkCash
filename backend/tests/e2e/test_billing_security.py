import pytest
from httpx import AsyncClient
from unittest.mock import patch

from app.config import settings


@pytest.mark.asyncio
async def test_internal_upgrade_hidden_without_secret(client: AsyncClient, auth_headers):
    with patch.object(settings, "debug", False), patch.object(settings, "internal_upgrade_secret", "test-secret"):
        resp = await client.post(
            "/api/v1/billing/internal-upgrade",
            headers=auth_headers,
            json={"plan": "pro"},
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_internal_upgrade_with_secret(client: AsyncClient, auth_headers):
    with patch.object(settings, "debug", False), patch.object(settings, "google_play_verify_mock", True), patch.object(
        settings, "internal_upgrade_secret", "test-secret"
    ):
        resp = await client.post(
            "/api/v1/billing/internal-upgrade",
            headers={**auth_headers, "X-Internal-Upgrade-Secret": "test-secret"},
            json={"plan": "pro"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"]["plan"] == "pro"


@pytest.mark.asyncio
async def test_internal_upgrade_blocked_in_production_billing(client: AsyncClient, auth_headers):
    with patch.object(settings, "debug", False), patch.object(settings, "google_play_verify_mock", False), patch.object(
        settings, "billing_premium_unlocked", False
    ), patch.object(settings, "internal_upgrade_secret", "test-secret"):
        resp = await client.post(
            "/api/v1/billing/internal-upgrade",
            headers={**auth_headers, "X-Internal-Upgrade-Secret": "test-secret"},
            json={"plan": "pro"},
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_forgot_password_neutral_response(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "missing-user@talkcash.io"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_password_reset_flow(client: AsyncClient):
    email = "reset-flow@talkcash.io"
    password = "ResetFlow1!"
    new_password = "NewResetFlow2!"

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Reset User"},
    )
    assert reg.status_code == 200

    forgot = await client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert forgot.status_code == 200
    reset_token = forgot.json().get("reset_token")
    assert reset_token

    bad = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "invalid-token", "new_password": new_password},
    )
    assert bad.status_code == 400

    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": new_password},
    )
    assert reset.status_code == 200

    old_login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert old_login.status_code == 401

    new_login = await client.post("/api/v1/auth/login", json={"email": email, "password": new_password})
    assert new_login.status_code == 200
