"""Tests for remaining roadmap features."""
import uuid
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_shared_wallet_admin(client: AsyncClient, auth_headers):
    created = await client.post("/api/v1/social/shared-wallet?name=Trip&member_email=", headers=auth_headers)
    assert created.status_code == 200, created.text
    wallet_id = created.json()["id"]

    renamed = await client.patch(
        f"/api/v1/social/shared-wallet/{wallet_id}?name=Holiday",
        headers=auth_headers,
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Holiday"

    deleted = await client.delete(f"/api/v1/social/shared-wallet/{wallet_id}", headers=auth_headers)
    assert deleted.status_code == 200, deleted.text


@pytest.mark.asyncio
async def test_shared_wallet_ownership_transfer(client: AsyncClient, auth_headers):
    member_email = f"member_{uuid.uuid4().hex[:8]}@talkcash.io"
    reg = await client.post("/api/v1/auth/register", json={
        "email": member_email, "password": "testpass123", "full_name": "Member User",
    })
    assert reg.status_code == 200, reg.text

    created = await client.post(
        f"/api/v1/social/shared-wallet?name=Team&member_email={member_email}",
        headers=auth_headers,
    )
    assert created.status_code == 200, created.text
    wallet_id = created.json()["id"]

    members = await client.get(f"/api/v1/social/shared-wallet/{wallet_id}/members", headers=auth_headers)
    assert members.status_code == 200, members.text
    member_id = next(m["user_id"] for m in members.json()["members"] if m["name"] == "Member User")

    transferred = await client.post(
        f"/api/v1/social/shared-wallet/{wallet_id}/transfer?member_id={member_id}",
        headers=auth_headers,
    )
    assert transferred.status_code == 200, transferred.text
    assert transferred.json()["owner_id"] == member_id

    listing = await client.get("/api/v1/social/shared-wallet", headers=auth_headers)
    wallet = next(w for w in listing.json() if w["id"] == wallet_id)
    assert wallet["is_owner"] is False
    assert wallet["owner_id"] == member_id


@pytest.mark.asyncio
async def test_sync_wallet_create_and_income_same_batch(client: AsyncClient, auth_headers):
    client_wallet_id = str(uuid.uuid4())
    create_op = str(uuid.uuid4())
    income_op = str(uuid.uuid4())
    push = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [
            {
                "id": create_op,
                "type": "wallet_create",
                "payload": {
                    "name": "Offline Kasa",
                    "wallet_type": "cash",
                    "currency": "TRY",
                    "client_wallet_id": client_wallet_id,
                },
                "client_timestamp": datetime.utcnow().isoformat(),
            },
            {
                "id": income_op,
                "type": "wallet_income",
                "payload": {
                    "wallet_id": client_wallet_id,
                    "amount": 250,
                    "description": "Maaş",
                },
                "client_timestamp": datetime.utcnow().isoformat(),
            },
        ],
    })
    assert push.status_code == 200, push.text
    body = push.json()
    assert len(body["applied"]) == 2
    assert body["failed"] == []

    pull = await client.get("/api/v1/sync/pull", headers=auth_headers)
    assert pull.status_code == 200
    wallets = pull.json()["wallets"]
    created = next(w for w in wallets if w["name"] == "Offline Kasa")
    assert float(created["balance"]) == 250.0


@pytest.mark.asyncio
async def test_sync_budget_crud(client: AsyncClient, auth_headers):
    client_budget_id = str(uuid.uuid4())
    create_op = str(uuid.uuid4())
    push = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [
            {
                "id": create_op,
                "type": "budget_create",
                "payload": {
                    "category": "Market",
                    "monthly_limit": 3000,
                    "client_budget_id": client_budget_id,
                },
                "client_timestamp": datetime.utcnow().isoformat(),
            },
        ],
    })
    assert push.status_code == 200, push.text
    assert len(push.json()["applied"]) == 1

    budgets = await client.get("/api/v1/budgets/", headers=auth_headers)
    assert budgets.status_code == 200
    assert any(b["category"] == "Market" for b in budgets.json())


@pytest.mark.asyncio
async def test_sync_wallet_create(client: AsyncClient, auth_headers):
    op_id = str(uuid.uuid4())
    due = (datetime.utcnow() + timedelta(days=7)).isoformat()
    push = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [
            {
                "id": op_id,
                "type": "wallet_create",
                "payload": {"name": "Offline Kasa", "wallet_type": "cash", "currency": "TRY"},
                "client_timestamp": datetime.utcnow().isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "type": "agenda_add_bill",
                "payload": {"title": "Elektrik", "amount": 200, "due_date": due, "force": True},
                "client_timestamp": datetime.utcnow().isoformat(),
            },
        ],
    })
    assert push.status_code == 200, push.text
    assert len(push.json()["applied"]) == 2


@pytest.mark.asyncio
async def test_chat_mentor(client: AsyncClient, auth_headers):
    resp = await client.post("/api/v1/ai/chat", headers=auth_headers, json={"message": "Merhaba"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["role"] == "assistant"
    assert resp.json()["content"]

    history = await client.get("/api/v1/ai/chat/history", headers=auth_headers)
    assert history.status_code == 200
    assert len(history.json()) >= 2
