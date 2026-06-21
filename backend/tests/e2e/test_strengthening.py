import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_notification_preferences_defaults(client: AsyncClient, auth_headers):
    resp = await client.get("/api/v1/notifications/preferences", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["agenda_reminder"] is True
    assert body["quiet_hours_enabled"] is False


@pytest.mark.asyncio
async def test_notification_preferences_update(client: AsyncClient, auth_headers):
    patch = await client.patch(
        "/api/v1/notifications/preferences",
        headers=auth_headers,
        json={"budget_warning": False, "quiet_hours_enabled": True},
    )
    assert patch.status_code == 200
    assert patch.json()["budget_warning"] is False
    assert patch.json()["quiet_hours_enabled"] is True


@pytest.mark.asyncio
async def test_demo_seed_idempotent(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "demo-seed@talkcash.io", "password": "DemoSeed1!", "full_name": "Demo User"},
    )
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    first = await client.post("/api/v1/demo/seed", headers=headers)
    assert first.status_code == 200
    assert first.json()["status"] == "seeded"

    second = await client.post("/api/v1/demo/seed", headers=headers)
    assert second.status_code == 200
    assert second.json()["status"] == "already_seeded"


@pytest.mark.asyncio
async def test_workspace_invitations_list_and_cancel(client: AsyncClient, auth_headers):
    from unittest.mock import patch

    from app.config import settings

    with patch.object(settings, "debug", False), patch.object(settings, "internal_upgrade_secret", "test-secret"):
        upgrade = await client.post(
            "/api/v1/billing/internal-upgrade",
            headers={**auth_headers, "X-Internal-Upgrade-Secret": "test-secret"},
            json={"plan": "family"},
        )
        assert upgrade.status_code == 200

    create = await client.post(
        "/api/v1/workspaces/",
        headers=auth_headers,
        json={"name": "Aile Bütçesi", "workspace_type": "family"},
    )
    assert create.status_code == 200
    workspace_id = create.json()["id"]

    invite = await client.post(
        f"/api/v1/workspaces/{workspace_id}/invite",
        headers=auth_headers,
        json={"email": "member@talkcash.io", "role": "member"},
    )
    assert invite.status_code == 200
    invitation_id = invite.json()["id"]

    listed = await client.get(f"/api/v1/workspaces/{workspace_id}/invitations", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["email"] == "member@talkcash.io"

    cancel = await client.delete(
        f"/api/v1/workspaces/{workspace_id}/invitations/{invitation_id}",
        headers=auth_headers,
    )
    assert cancel.status_code == 204

    after = await client.get(f"/api/v1/workspaces/{workspace_id}/invitations", headers=auth_headers)
    assert after.status_code == 200
    assert after.json() == []
