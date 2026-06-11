"""E2E tests for Siri / Google Assistant command flows (parse → confirm → execute)."""

from datetime import datetime, timedelta
from urllib.parse import quote

import pytest
from httpx import AsyncClient


async def _parse(client: AsyncClient, headers: dict, text: str) -> dict:
    resp = await client.post(
        f"/api/v1/input/parse?text={quote(text)}",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _execute(client: AsyncClient, headers: dict, parsed: dict) -> dict:
    resp = await client.post(
        "/api/v1/execute/confirm",
        headers=headers,
        json={"parsed": parsed, "action": {"confirmed": True}},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _wallet_id(client: AsyncClient, headers: dict, name_contains: str) -> str:
    resp = await client.get("/api/v1/wallets/", headers=headers)
    assert resp.status_code == 200
    for wallet in resp.json():
        if name_contains.lower() in wallet["name"].lower():
            return wallet["id"]
    raise AssertionError(f"Wallet matching '{name_contains}' not found")


@pytest.mark.asyncio
async def test_assistant_siri_expense_flow(client: AsyncClient, auth_headers: dict):
    """Simulates Siri deep link text: 150 TL kahve banka."""
    before = await client.get("/api/v1/wallets/net-worth", headers=auth_headers)
    before_total = float(before.json()["total_try"])

    card = await _parse(client, auth_headers, "150 TL kahve banka")
    assert card["parsed"]["intent"] == "add_expense"

    result = await _execute(client, auth_headers, card["parsed"])
    assert result["status"] == "success"

    after = await client.get("/api/v1/wallets/net-worth", headers=auth_headers)
    assert float(after.json()["total_try"]) == before_total - 150


@pytest.mark.asyncio
async def test_assistant_google_money_transfer_flow(client: AsyncClient, auth_headers: dict):
    """Simulates Google CREATE_MONEY_TRANSFER params → 200 TL market."""
    card = await _parse(client, auth_headers, "200 TL market")
    assert card["parsed"]["intent"] == "add_expense"
    assert float(card["parsed"]["amount"]) == 200

    result = await _execute(client, auth_headers, card["parsed"])
    assert result["status"] == "success"


@pytest.mark.asyncio
async def test_assistant_siri_income_flow(client: AsyncClient, auth_headers: dict):
    """Simulates Siri income shortcut: maaşım yattı 45000 banka."""
    before = await client.get("/api/v1/wallets/net-worth", headers=auth_headers)
    before_total = float(before.json()["total_try"])

    card = await _parse(client, auth_headers, "maaşım yattı 45000 banka")
    assert card["parsed"]["intent"] == "add_income"

    result = await _execute(client, auth_headers, card["parsed"])
    assert result["status"] == "success"

    after = await client.get("/api/v1/wallets/net-worth", headers=auth_headers)
    assert float(after.json()["total_try"]) == before_total + 45000


@pytest.mark.asyncio
async def test_assistant_google_shopping_list_flow(client: AsyncClient, auth_headers: dict):
    """Simulates Google CREATE_ITEM_LIST params → listeye süt ekle."""
    card = await _parse(client, auth_headers, "listeye süt ekle")
    assert card["parsed"]["intent"] == "add_shopping"

    result = await _execute(client, auth_headers, card["parsed"])
    assert result["status"] == "success"

    listing = await client.get("/api/v1/shopping/", headers=auth_headers)
    assert listing.status_code == 200
    grouped = listing.json()
    names = [
        item["name"].lower()
        for items in grouped.values()
        for item in items
    ]
    assert any("süt" in name for name in names)


@pytest.mark.asyncio
async def test_assistant_google_mark_paid_flow(client: AsyncClient, auth_headers: dict):
    """Simulates Google OPEN_APP_FEATURE → elektrik faturasını ödedim."""
    due = (datetime.utcnow() + timedelta(days=10)).isoformat()
    add = await client.post(
        f"/api/v1/agenda/bill?title=Elektrik&amount=250&due_date={due}&force=true",
        headers=auth_headers,
    )
    assert add.status_code == 200

    card = await _parse(client, auth_headers, "elektrik faturasını ödedim")
    assert card["parsed"]["intent"] == "mark_paid"

    result = await _execute(client, auth_headers, card["parsed"])
    assert result["status"] == "success"
    assert result["result"]["status"] == "paid"


@pytest.mark.asyncio
async def test_assistant_english_google_expense(client: AsyncClient, auth_headers: dict):
    """Simulates English Google Assistant command after locale switch."""
    locale = await client.put("/api/v1/auth/locale", headers=auth_headers, json={"locale": "en"})
    assert locale.status_code == 200

    card = await _parse(client, auth_headers, "150 coffee bank")
    assert card["parsed"]["intent"] == "add_expense"

    result = await _execute(client, auth_headers, card["parsed"])
    assert result["status"] == "success"


@pytest.mark.asyncio
async def test_assistant_english_cash_expense(client: AsyncClient, auth_headers: dict):
    """English 'cash' wallet alias must resolve to Nakit."""
    await client.put("/api/v1/auth/locale", headers=auth_headers, json={"locale": "en"})
    card = await _parse(client, auth_headers, "50 coffee cash")
    assert card["parsed"]["intent"] == "add_expense"
    result = await _execute(client, auth_headers, card["parsed"])
    assert result["status"] == "success"
