import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert "locales" in resp.json()


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
    if reg.status_code == 400 and "kayıtlı" in reg.json().get("detail", ""):
        login = await client.post("/api/v1/auth/login", json={"email": email, "password": "securepass"})
        assert login.status_code == 200
    else:
        assert reg.status_code == 200
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
