"""Monthly wallet summary report."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_monthly_summary_includes_categories(client: AsyncClient, auth_headers):
    wallet_resp = await client.get("/api/v1/wallets/", headers=auth_headers)
    wallets = wallet_resp.json()
    assert wallets
    wallet_id = wallets[0]["id"]

    await client.post(
        f"/api/v1/wallets/expense?wallet_id={wallet_id}&amount=120&category=Market&description=test",
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/wallets/monthly-summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "top_categories" in body
    assert "budget_health" in body
    assert body["expense"] >= 120
    assert isinstance(body.get("savings_rate"), (int, float, type(None)))
