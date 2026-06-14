"""E2E tests for offline sync: chained ops, conflicts, pull snapshot."""
import uuid
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sync_pull_includes_budgets(client: AsyncClient, auth_headers):
    create = await client.post(
        "/api/v1/budgets/",
        headers=auth_headers,
        json={"category": "Market", "monthly_limit": 2500},
    )
    assert create.status_code == 200, create.text

    pull = await client.get("/api/v1/sync/pull", headers=auth_headers)
    assert pull.status_code == 200, pull.text
    budgets = pull.json().get("budgets") or []
    assert any(b["category"] == "Market" for b in budgets)


@pytest.mark.asyncio
async def test_sync_chained_wallet_budget_batch(client: AsyncClient, auth_headers):
    client_wallet_id = str(uuid.uuid4())
    client_budget_id = str(uuid.uuid4())
    push = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [
            {
                "id": str(uuid.uuid4()),
                "type": "wallet_create",
                "payload": {
                    "name": "Offline Zincir",
                    "wallet_type": "cash",
                    "currency": "TRY",
                    "client_wallet_id": client_wallet_id,
                },
                "client_timestamp": datetime.utcnow().isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "type": "wallet_income",
                "payload": {
                    "wallet_id": client_wallet_id,
                    "amount": 500,
                    "description": "Test gelir",
                },
                "client_timestamp": datetime.utcnow().isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "type": "budget_create",
                "payload": {
                    "category": "Ulaşım",
                    "monthly_limit": 1500,
                    "client_budget_id": client_budget_id,
                },
                "client_timestamp": datetime.utcnow().isoformat(),
            },
        ],
    })
    assert push.status_code == 200, push.text
    body = push.json()
    assert len(body["applied"]) == 3
    assert body["failed"] == []

    pull = await client.get("/api/v1/sync/pull", headers=auth_headers)
    wallets = pull.json()["wallets"]
    wallet = next(w for w in wallets if w["name"] == "Offline Zincir")
    assert float(wallet["balance"]) == 500.0
    assert any(b["category"] == "Ulaşım" for b in pull.json()["budgets"])


@pytest.mark.asyncio
async def test_sync_shopping_conflict_and_resolve(client: AsyncClient, auth_headers):
    add_resp = await client.post(
        "/api/v1/shopping/add",
        headers=auth_headers,
        json={"items": ["ConflictItem"]},
    )
    assert add_resp.status_code == 200, add_resp.text
    assert add_resp.json()["added"] == 1

    listing = await client.get("/api/v1/shopping/", headers=auth_headers)
    assert listing.status_code == 200, listing.text
    item_id = None
    for items in listing.json().values():
        for item in items:
            if item["name"] == "ConflictItem":
                item_id = item["id"]
                break
    assert item_id

    await client.post(f"/api/v1/shopping/complete/{item_id}", headers=auth_headers)

    op_id = str(uuid.uuid4())
    stale_ts = (datetime.utcnow() - timedelta(hours=2)).isoformat()
    push = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [{
            "id": op_id,
            "type": "shopping_complete",
            "payload": {"item_id": item_id, "price": 25},
            "client_timestamp": stale_ts,
        }],
    })
    assert push.status_code == 200, push.text
    assert len(push.json()["conflicts"]) == 1

    resolve = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [{
            "id": str(uuid.uuid4()),
            "type": "shopping_complete",
            "payload": {"item_id": item_id, "price": 25},
            "client_timestamp": stale_ts,
            "resolve_strategy": "server",
        }],
    })
    assert resolve.status_code == 200, resolve.text
    assert len(resolve.json()["applied"]) == 1


@pytest.mark.asyncio
async def test_sync_budget_update_delete(client: AsyncClient, auth_headers):
    create_op = str(uuid.uuid4())
    push = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [{
            "id": create_op,
            "type": "budget_create",
            "payload": {"category": "Sağlık", "monthly_limit": 800},
            "client_timestamp": datetime.utcnow().isoformat(),
        }],
    })
    assert push.status_code == 200, push.text
    budget_id = push.json()["applied"][0]["result"]["budget_id"]

    update = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [{
            "id": str(uuid.uuid4()),
            "type": "budget_update",
            "payload": {"budget_id": budget_id, "monthly_limit": 1200},
            "client_timestamp": datetime.utcnow().isoformat(),
        }],
    })
    assert update.status_code == 200, update.text

    delete = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [{
            "id": str(uuid.uuid4()),
            "type": "budget_delete",
            "payload": {"budget_id": budget_id},
            "client_timestamp": datetime.utcnow().isoformat(),
        }],
    })
    assert delete.status_code == 200, delete.text

    budgets = await client.get("/api/v1/budgets/", headers=auth_headers)
    assert not any(b["category"] == "Sağlık" for b in budgets.json())
