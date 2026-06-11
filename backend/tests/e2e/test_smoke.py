"""End-to-end smoke flow — mirrors scripts/smoke_test.py for CI."""

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_smoke_flow(client: AsyncClient):
    health = await client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] in ("ok", "degraded")

    email = f"smoke_{uuid.uuid4().hex[:8]}@talkcash.io"
    reg = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "testpass123",
        "full_name": "Smoke Test",
    })
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    wallets = await client.get("/api/v1/wallets/", headers=auth)
    assert wallets.status_code == 200, wallets.text
    wallet_list = wallets.json()
    assert isinstance(wallet_list, list) and len(wallet_list) >= 1

    for w in wallet_list:
        if w.get("wallet_type") == "credit_card":
            continue
        fund = await client.post(
            f"/api/v1/wallets/income?wallet_id={w['id']}&amount=50000&description=smoke",
            headers=auth,
        )
        assert fund.status_code == 200, fund.text

    parsed = await client.post("/api/v1/input/parse?text=50%20TL%20kahve", headers=auth)
    assert parsed.status_code == 200, parsed.text
    parsed_data = parsed.json()
    assert parsed_data.get("parsed", {}).get("intent") == "add_expense"

    executed = await client.post("/api/v1/execute/confirm", headers=auth, json={
        "parsed": parsed_data["parsed"],
        "action": {"confirmed": True},
    })
    assert executed.status_code == 200, executed.text
    assert executed.json().get("status") == "success"

    shopping = await client.post("/api/v1/shopping/add", headers=auth, json={"items": ["SmokeItem"]})
    assert shopping.status_code == 200, shopping.text

    price = await client.get("/api/v1/ai/price-tracker?product=milk", headers=auth)
    assert price.status_code == 200, price.text
    assert "has_data" in price.json()

    i18n = await client.get("/api/v1/i18n/en")
    assert i18n.status_code == 200
    assert "auth.login_success" in i18n.json()
