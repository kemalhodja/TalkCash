"""E2E smoke for micro-savings assistant."""

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_micro_savings_flow(client: AsyncClient):
    email = f"ms_{uuid.uuid4().hex[:8]}@talkcash.io"
    reg = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "testpass123",
        "full_name": "MS Smoke",
    })
    assert reg.status_code == 200, reg.text
    auth = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    for w in (await client.get("/api/v1/wallets/", headers=auth)).json():
        if w.get("wallet_type") != "credit_card":
            await client.post(
                f"/api/v1/wallets/income?wallet_id={w['id']}&amount=50000&description=seed",
                headers=auth,
            )

    prefs = await client.patch("/api/v1/micro-savings/prefs", headers=auth, json={
        "round_up_enabled": True,
        "round_up_step": 10,
    })
    assert prefs.status_code == 200

    denied = await client.patch("/api/v1/micro-savings/prefs", headers=auth, json={"auto_round_up": True})
    assert denied.status_code == 402

    expense = await client.post("/api/v1/execute/confirm", headers=auth, json={
        "action": {"confirmed": True},
        "parsed": {
            "intent": "add_expense",
            "amount": 55,
            "category": "Yeme",
            "description": "Starbucks kahve",
            "wallet_name": "Nakit",
        },
    })
    assert expense.status_code == 200, expense.text
    result = expense.json()["result"]
    swap = result.get("swap_nudge")
    assert swap and swap.get("saved_amount", 0) > 0
    assert not swap.get("locked")
    assert result.get("round_up")

    transfer = await client.post("/api/v1/micro-savings/transfer", headers=auth, json={
        "from_wallet_id": swap["source_wallet_id"],
        "to_wallet_id": swap["target_wallet_id"],
        "amount": swap["saved_amount"],
        "rule_key": swap["rule_key"],
    })
    assert transfer.status_code == 200, transfer.text

    summary = await client.get("/api/v1/micro-savings/summary", headers=auth)
    assert summary.status_code == 200
    assert summary.json()["week_saved"] >= swap["saved_amount"]
    assert summary.json().get("live_rates", {}).get("gold_try_per_gram", 0) > 0

    rates = await client.get("/api/v1/micro-savings/rates", headers=auth)
    assert rates.status_code == 200

    sim = await client.post("/api/v1/micro-savings/simulate", headers=auth, json={"months": 12})
    assert sim.status_code == 200
    assert sim.json()["final_balance"] > 0
