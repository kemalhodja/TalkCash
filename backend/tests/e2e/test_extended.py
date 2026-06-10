import uuid
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient


async def _wallet_id(client: AsyncClient, headers: dict, name_contains: str) -> str:
    resp = await client.get("/api/v1/wallets/", headers=headers)
    assert resp.status_code == 200
    for w in resp.json():
        if name_contains.lower() in w["name"].lower():
            return w["id"]
    raise AssertionError(f"Wallet matching '{name_contains}' not found")


@pytest.mark.asyncio
async def test_income_endpoint(client: AsyncClient, auth_headers: dict):
    bank_id = await _wallet_id(client, auth_headers, "Banka")
    before = await client.get("/api/v1/wallets/net-worth", headers=auth_headers)
    before_total = float(before.json()["total_try"])

    resp = await client.post(
        f"/api/v1/wallets/income?wallet_id={bank_id}&amount=1500&description=Maaş",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["transaction_type"] == "income"

    after = await client.get("/api/v1/wallets/net-worth", headers=auth_headers)
    assert float(after.json()["total_try"]) == before_total + 1500


@pytest.mark.asyncio
async def test_timezone_update(client: AsyncClient, auth_headers: dict):
    resp = await client.put("/api/v1/auth/timezone", headers=auth_headers, json={"timezone": "Europe/London"})
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "Europe/London"

    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.json()["timezone"] == "Europe/London"


@pytest.mark.asyncio
async def test_slash_command_parse(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/input/slash?command=%2F200%20kahve%20banka",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    parsed = resp.json()["parsed"]
    assert parsed["intent"] == "add_expense"
    assert float(parsed["amount"]) == 200


@pytest.mark.asyncio
async def test_sync_pull_includes_wallets(client: AsyncClient, auth_headers: dict):
    pull = await client.get("/api/v1/sync/pull", headers=auth_headers)
    assert pull.status_code == 200
    data = pull.json()
    assert "wallets" in data
    assert "transactions" in data
    assert "receipts" in data
    assert len(data["wallets"]) >= 1


@pytest.mark.asyncio
async def test_input_capabilities(client: AsyncClient):
    resp = await client.get("/api/v1/input/capabilities")
    assert resp.status_code == 200
    assert "voice_available" in resp.json()


@pytest.mark.asyncio
async def test_sync_push_and_pull(client: AsyncClient, auth_headers: dict):
    op_id = str(uuid.uuid4())
    push = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [{
            "id": op_id,
            "type": "shopping_add",
            "payload": {"items": ["E2E Peynir"]},
            "client_timestamp": datetime.utcnow().isoformat(),
        }],
    })
    assert push.status_code == 200
    body = push.json()
    assert len(body["applied"]) == 1
    assert body["applied"][0]["status"] == "ok"

    pull = await client.get("/api/v1/sync/pull", headers=auth_headers)
    assert pull.status_code == 200
    names = [i["name"] for i in pull.json()["shopping"]]
    assert "E2E Peynir" in names

    # Idempotency: same op_id should not duplicate
    dup = await client.post("/api/v1/sync/push", headers=auth_headers, json={
        "operations": [{
            "id": op_id,
            "type": "shopping_add",
            "payload": {"items": ["E2E Peynir"]},
            "client_timestamp": datetime.utcnow().isoformat(),
        }],
    })
    assert dup.json()["applied"][0]["status"] == "duplicate"


@pytest.mark.asyncio
async def test_credit_card_liability_net_worth(client: AsyncClient, auth_headers: dict):
    cc_id = await _wallet_id(client, auth_headers, "Kredi")
    before = await client.get("/api/v1/wallets/net-worth", headers=auth_headers)
    before_total = float(before.json()["total_try"])

    expense = await client.post(
        f"/api/v1/wallets/expense?wallet_id={cc_id}&amount=500&category=Market&description=CC%20test",
        headers=auth_headers,
    )
    assert expense.status_code == 200

    after = await client.get("/api/v1/wallets/net-worth", headers=auth_headers)
    assert float(after.json()["total_try"]) == before_total - 500


@pytest.mark.asyncio
async def test_agenda_days_filter(client: AsyncClient, auth_headers: dict):
    far_due = (datetime.utcnow() + timedelta(days=45)).isoformat()
    add = await client.post(
        f"/api/v1/agenda/bill?title=FarBill&amount=50&due_date={far_due}&force=true",
        headers=auth_headers,
    )
    assert add.status_code == 200

    short = await client.get("/api/v1/agenda/?days=30", headers=auth_headers)
    assert short.status_code == 200
    assert not any(i["title"] == "FarBill" for i in short.json())

    long = await client.get("/api/v1/agenda/?days=60", headers=auth_headers)
    assert long.status_code == 200
    assert any(i["title"] == "FarBill" for i in long.json())


@pytest.mark.asyncio
async def test_budget_with_usage(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/v1/budgets/", headers=auth_headers, json={
        "category": "Market", "monthly_limit": 1000,
    })
    assert create.status_code == 200

    listing = await client.get("/api/v1/budgets/", headers=auth_headers)
    assert listing.status_code == 200
    market = next(b for b in listing.json() if b["category"] == "Market")
    assert "spent" in market
    assert "percent" in market
    assert market["monthly_limit"] == 1000


@pytest.mark.asyncio
async def test_shared_wallet_flow(client: AsyncClient, auth_headers: dict):
    create = await client.post(
        "/api/v1/social/shared-wallet?name=E2E%20Ortak",
        headers=auth_headers,
    )
    assert create.status_code == 200
    wallet_id = create.json()["id"]

    listing = await client.get("/api/v1/social/shared-wallet", headers=auth_headers)
    assert listing.status_code == 200
    assert any(w["id"] == wallet_id for w in listing.json())

    expense = await client.post(
        f"/api/v1/social/shared-wallet/{wallet_id}/expense?amount=100&description=Test",
        headers=auth_headers,
    )
    assert expense.status_code == 200
    assert float(expense.json()["balance"]) < float(create.json()["balance"])
