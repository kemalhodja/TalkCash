"""E2E tests for Phase 1/2 plan gaps."""
import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_refresh_token_flow(client: AsyncClient):
    email = f"refresh_{uuid.uuid4().hex[:8]}@talkcash.io"
    reg = await client.post("/api/v1/auth/register", json={
        "email": email, "password": "testpass123", "full_name": "Refresh User",
    })
    assert reg.status_code == 200, reg.text
    data = reg.json()
    assert "refresh_token" in data
    assert "access_token" in data

    refresh = await client.post("/api/v1/auth/refresh", json={"refresh_token": data["refresh_token"]})
    assert refresh.status_code == 200, refresh.text
    new_tokens = refresh.json()
    assert new_tokens["refresh_token"] != data["refresh_token"]

    headers = {"Authorization": f"Bearer {new_tokens['access_token']}"}
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200


@pytest.mark.asyncio
async def test_change_password(client: AsyncClient, auth_headers):
    resp = await client.put("/api/v1/auth/password", headers=auth_headers, json={
        "current_password": "testpass123",
        "new_password": "newpass456",
    })
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_transaction_update_delete(client: AsyncClient, auth_headers):
    wallets = await client.get("/api/v1/wallets/", headers=auth_headers)
    wallet_id = wallets.json()[0]["id"]
    income = await client.post(
        f"/api/v1/wallets/income?wallet_id={wallet_id}&amount=50&description=test_tx",
        headers=auth_headers,
    )
    assert income.status_code == 200

    txs = await client.get("/api/v1/transactions/", headers=auth_headers)
    assert txs.status_code == 200
    tx = txs.json()[0]
    tx_id = tx["id"]

    updated = await client.patch(
        f"/api/v1/transactions/{tx_id}",
        headers=auth_headers,
        json={"description": "updated desc", "category": "Test"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["description"] == "updated desc"

    deleted = await client.delete(f"/api/v1/transactions/{tx_id}", headers=auth_headers)
    assert deleted.status_code == 200, deleted.text


@pytest.mark.asyncio
async def test_debt_update_delete(client: AsyncClient, auth_headers):
    created = await client.post(
        "/api/v1/social/debt?person_name=Ali&amount=100&is_lent=true",
        headers=auth_headers,
    )
    assert created.status_code == 200
    debt_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/social/debts/{debt_id}?person_name=Veli&amount=150",
        headers=auth_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["person"] == "Veli"

    deleted = await client.delete(f"/api/v1/social/debts/{debt_id}", headers=auth_headers)
    assert deleted.status_code == 200, deleted.text


@pytest.mark.asyncio
async def test_notification_metadata(client: AsyncClient, auth_headers):
    from uuid import UUID

    from tests.e2e.conftest import TestSession
    from app.services.notifications.service import NotificationService

    user_resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = UUID(user_resp.json()["id"])

    async with TestSession() as db:
        svc = NotificationService()
        await svc.create_in_app(
            db, user_id, "Test", "Body", "budget_warning", {"route": "/budget"},
        )

    items = await client.get("/api/v1/notifications/", headers=auth_headers)
    assert items.status_code == 200
    assert items.json()[0]["metadata"]["route"] == "/budget"


@pytest.mark.asyncio
async def test_delete_account(client: AsyncClient):
    email = f"del_{uuid.uuid4().hex[:8]}@talkcash.io"
    reg = await client.post("/api/v1/auth/register", json={
        "email": email, "password": "testpass123", "full_name": "Delete Me",
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    deleted = await client.request(
        "DELETE", "/api/v1/auth/me",
        headers=headers,
        json={"password": "testpass123"},
    )
    assert deleted.status_code == 200, deleted.text

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 401
