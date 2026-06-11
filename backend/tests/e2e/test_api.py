import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "degraded")
    assert "locales" in data
    assert "checks" in data


@pytest.mark.asyncio
async def test_i18n_endpoint(client: AsyncClient):
    resp = await client.get("/api/v1/i18n/en")
    assert resp.status_code == 200
    assert "auth.login_success" in resp.json()


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    email = "e2e_user@talkcash.io"
    reg = await client.post("/api/v1/auth/register", json={
        "email": email, "password": "securepass", "full_name": "E2E User",
    })
    detail = str(reg.json().get("detail", "")).lower()
    if reg.status_code == 400 and any(k in detail for k in ("kayıtlı", "registered", "zaten", "already")):
        login = await client.post("/api/v1/auth/login", json={"email": email, "password": "securepass"})
        assert login.status_code == 200
    else:
        assert reg.status_code == 200, reg.text
        assert "access_token" in reg.json()


@pytest.mark.asyncio
async def test_wallets_flow(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/wallets/net-worth", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_try" in data
    assert len(data["wallets"]) >= 1


@pytest.mark.asyncio
async def test_budget_crud(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/v1/budgets/", headers=auth_headers, json={
        "category": "Restoran", "monthly_limit": 4000,
    })
    assert create.status_code == 200
    budget_id = create.json()["id"]

    listing = await client.get("/api/v1/budgets/", headers=auth_headers)
    assert listing.status_code == 200
    assert any(b["id"] == budget_id for b in listing.json())

    delete = await client.delete(f"/api/v1/budgets/{budget_id}", headers=auth_headers)
    assert delete.status_code == 200


@pytest.mark.asyncio
async def test_nlp_parse(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/input/parse?text=150%20TL%20kahve",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data
    assert data["parsed"]["intent"] == "add_expense"


@pytest.mark.asyncio
async def test_shopping_add(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/shopping/add", headers=auth_headers, json={"items": ["Süt", "Ekmek"]})
    assert resp.status_code == 200
    assert resp.json()["added"] == 2

    listing = await client.get("/api/v1/shopping/", headers=auth_headers)
    assert listing.status_code == 200


@pytest.mark.asyncio
async def test_locale_update(client: AsyncClient, auth_headers: dict):
    resp = await client.put("/api/v1/auth/locale", headers=auth_headers, json={"locale": "en"})
    assert resp.status_code == 200
    assert resp.json()["locale"] == "en"

    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.json()["locale"] == "en"


@pytest.mark.asyncio
async def test_split_bill(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/social/split?total=300&person_count=3", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["per_person"] == 100.0


@pytest.mark.asyncio
async def test_geofence_markets(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/geofence/markets?lat=40.9902&lng=29.0298&radius_km=3",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1
    assert "name" in data["markets"][0]
    assert "distance_km" in data["markets"][0]
    assert "source" in data


@pytest.mark.asyncio
async def test_agenda_bill_and_pay(client: AsyncClient, auth_headers: dict):
    from datetime import datetime, timedelta
    due = (datetime.utcnow() + timedelta(days=14)).isoformat()
    add = await client.post(
        f"/api/v1/agenda/bill?title=TestNet&amount=99&due_date={due}&is_recurring=false&force=true",
        headers=auth_headers,
    )
    assert add.status_code == 200

    pay = await client.post("/api/v1/agenda/pay?title=TestNet", headers=auth_headers)
    assert pay.status_code == 200
    assert pay.json()["status"] == "paid"
