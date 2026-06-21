"""E2E tests for V1.2 persona, subscription, and quick-voice flows."""

import pytest
from httpx import AsyncClient


async def _execute_subscription(
    client: AsyncClient,
    auth_headers: dict,
    *,
    amount: float,
    description: str,
    raw_text: str,
) -> dict:
    executed = await client.post(
        "/api/v1/execute/confirm",
        headers=auth_headers,
        json={
            "parsed": {
                "intent": "add_expense",
                "amount": amount,
                "category": "Abonelik",
                "description": description,
                "wallet_name": "Banka",
                "raw_text": raw_text,
                "force": True,
            },
            "action": {"confirmed": True},
        },
    )
    assert executed.status_code == 200, executed.text
    return executed.json()


@pytest.mark.asyncio
async def test_persona_persistence(client: AsyncClient, auth_headers: dict):
    res = await client.put(
        "/api/v1/auth/persona",
        json={"assistant_persona": "angry_mom"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["assistant_persona"] == "angry_mom"

    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.status_code == 200
    assert me.json()["assistant_persona"] == "angry_mom"


@pytest.mark.asyncio
async def test_subscription_expense_sets_fields(client: AsyncClient, auth_headers: dict):
    body = await _execute_subscription(
        client,
        auth_headers,
        amount=150,
        description="Netflix aylık",
        raw_text="Bugün Netflix'e 150 TL ödedim",
    )
    assert body.get("result", {}).get("subscription", {}).get("subscription_name") == "Netflix"
    txs = await client.get("/api/v1/transactions/", headers=auth_headers)
    assert txs.status_code == 200
    items = txs.json()
    recurring = [t for t in items if t.get("is_recurring")]
    assert recurring
    assert recurring[0]["subscription_name"] == "Netflix"
    assert recurring[0]["next_billing_date"]


@pytest.mark.asyncio
async def test_sync_pull_includes_subscription_fields(client: AsyncClient, auth_headers: dict):
    await _execute_subscription(
        client,
        auth_headers,
        amount=60,
        description="Spotify",
        raw_text="spotify aylık 60 lira",
    )
    sync = await client.get("/api/v1/sync/pull", headers=auth_headers)
    assert sync.status_code == 200
    txs = sync.json().get("transactions") or []
    subs = [t for t in txs if t.get("is_recurring")]
    assert subs
    assert subs[0].get("subscription_name")
    assert subs[0].get("next_billing_date")


@pytest.mark.asyncio
async def test_invalid_persona_rejected(client: AsyncClient, auth_headers: dict):
    res = await client.put(
        "/api/v1/auth/persona",
        json={"assistant_persona": "evil_bot"},
        headers=auth_headers,
    )
    assert res.status_code == 400
