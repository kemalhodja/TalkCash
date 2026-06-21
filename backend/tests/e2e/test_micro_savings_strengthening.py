"""E2E strengthening for micro-savings flows."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_micro_savings_invalid_transfer_rejected(client: AsyncClient, auth_headers: dict):
    wallets = (await client.get("/api/v1/wallets/", headers=auth_headers)).json()
    cash = next(w for w in wallets if w["name"] == "Nakit")
    bank = next(w for w in wallets if w["name"] == "Banka")

    resp = await client.post("/api/v1/micro-savings/transfer", headers=auth_headers, json={
        "from_wallet_id": cash["id"],
        "to_wallet_id": bank["id"],
        "amount": 10,
        "rule_key": "coffee",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_micro_savings_demo_seed_includes_transfer(client: AsyncClient):
    import uuid

    email = f"demo_ms_{uuid.uuid4().hex[:8]}@talkcash.io"
    reg = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "testpass123",
        "full_name": "Demo MS",
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    seed = await client.post("/api/v1/demo/seed", headers=headers)
    assert seed.status_code == 200
    body = seed.json()
    assert body["status"] == "seeded"
    assert body.get("micro_savings_demo") is True

    summary = await client.get("/api/v1/micro-savings/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json().get("week_saved", 0) >= 47


@pytest.mark.asyncio
async def test_health_includes_micro_savings_features(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    features = resp.json().get("features", {})
    assert features.get("micro_savings") is True
    assert features.get("live_rates") is True
