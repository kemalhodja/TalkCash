"""Notification mark-read tests."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_notification_mark_read(client: AsyncClient, auth_headers: dict):
    wallets = await client.get("/api/v1/wallets/", headers=auth_headers)
    assert wallets.status_code == 200
    wallet_id = wallets.json()[0]["id"]

    await client.post(
        "/api/v1/budgets/",
        json={"category": "NotifTestCat", "monthly_limit": 100},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/wallets/expense?wallet_id={wallet_id}&amount=85&category=NotifTestCat&description=test",
        headers=auth_headers,
    )

    listing = await client.get("/api/v1/notifications/", headers=auth_headers)
    assert listing.status_code == 200
    assert listing.json(), "budget alert should create a notification"
    nid = listing.json()[0]["id"]

    read = await client.post(f"/api/v1/notifications/{nid}/read", headers=auth_headers)
    assert read.status_code == 200
    assert read.json()["is_read"] is True

    mark_all = await client.post("/api/v1/notifications/read-all", headers=auth_headers)
    assert mark_all.status_code == 200
    assert mark_all.json()["marked"] >= 0
