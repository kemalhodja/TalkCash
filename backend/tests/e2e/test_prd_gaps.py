"""Tests for PRD gap features."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_wallet_update_and_deactivate(client: AsyncClient, auth_headers: dict):
    create = await client.post(
        "/api/v1/wallets/",
        json={"name": "Test USD", "wallet_type": "cash", "currency": "USD"},
        headers=auth_headers,
    )
    assert create.status_code == 200
    wallet_id = create.json()["id"]

    patch = await client.patch(
        f"/api/v1/wallets/{wallet_id}",
        json={"name": "Test USD Renamed"},
        headers=auth_headers,
    )
    assert patch.status_code == 200
    assert patch.json()["name"] == "Test USD Renamed"

    delete = await client.delete(f"/api/v1/wallets/{wallet_id}", headers=auth_headers)
    assert delete.status_code == 200


@pytest.mark.asyncio
async def test_agenda_history_and_crud(client: AsyncClient, auth_headers: dict):
    from datetime import datetime, timedelta

    due = (datetime.utcnow() + timedelta(days=5)).isoformat()
    add = await client.post(
        f"/api/v1/agenda/bill?title=TestNet&amount=99&due_date={due}&is_recurring=false&force=true",
        headers=auth_headers,
    )
    assert add.status_code == 200

    listing = await client.get("/api/v1/agenda/?days=30", headers=auth_headers)
    item = next(i for i in listing.json() if i["title"] == "TestNet")
    item_id = item["id"]

    patch = await client.patch(
        f"/api/v1/agenda/{item_id}",
        json={"title": "TestNet Updated", "amount": 120},
        headers=auth_headers,
    )
    assert patch.status_code == 200

    pay = await client.post("/api/v1/agenda/pay?title=TestNet Updated", headers=auth_headers)
    assert pay.status_code == 200

    history = await client.get("/api/v1/agenda/history?limit=10", headers=auth_headers)
    assert history.status_code == 200
    assert any(i["title"] == "TestNet Updated" for i in history.json())


@pytest.mark.asyncio
async def test_shopping_import_and_delete(client: AsyncClient, auth_headers: dict):
    add = await client.post(
        "/api/v1/shopping/add",
        json={"items": ["DeleteMeItem"]},
        headers=auth_headers,
    )
    assert add.status_code == 200

    listing = await client.get("/api/v1/shopping/", headers=auth_headers)
    flat = [i for items in listing.json().values() for i in items]
    item = next(i for i in flat if i["name"] == "DeleteMeItem")

    delete = await client.delete(f"/api/v1/shopping/{item['id']}", headers=auth_headers)
    assert delete.status_code == 200


@pytest.mark.asyncio
async def test_price_watchlist(client: AsyncClient, auth_headers: dict):
    add = await client.post(
        "/api/v1/ai/watchlist",
        json={"product_name": "süt", "threshold_percent": 5},
        headers=auth_headers,
    )
    assert add.status_code == 200
    item_id = add.json()["id"]

    listing = await client.get("/api/v1/ai/watchlist", headers=auth_headers)
    assert listing.status_code == 200
    assert any(i["id"] == item_id for i in listing.json())

    remove = await client.delete(f"/api/v1/ai/watchlist/{item_id}", headers=auth_headers)
    assert remove.status_code == 200
