import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_remove_pin(client: AsyncClient, auth_headers):
    set_resp = await client.post("/api/v1/auth/pin", headers=auth_headers, json={"pin": "1234"})
    assert set_resp.status_code == 200

    bad = await client.request("DELETE", "/api/v1/auth/pin", headers=auth_headers, json={"pin": "9999"})
    assert bad.status_code == 401

    ok = await client.request("DELETE", "/api/v1/auth/pin", headers=auth_headers, json={"pin": "1234"})
    assert ok.status_code == 200
    assert ok.json()["has_pin"] is False

    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.status_code == 200
    assert me.json()["has_pin"] is False

    again = await client.request("DELETE", "/api/v1/auth/pin", headers=auth_headers, json={"pin": "1234"})
    assert again.status_code == 400
