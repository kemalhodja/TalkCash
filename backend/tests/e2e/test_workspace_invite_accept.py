"""Workspace invitation accept flow."""

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_workspace_invite_accept_flow(client: AsyncClient, auth_headers):
    create = await client.post(
        "/api/v1/workspaces/",
        headers=auth_headers,
        json={"name": "Family Budget", "workspace_type": "family"},
    )
    if create.status_code == 402:
        pytest.skip("Premium workspace entitlement required")
    assert create.status_code == 200, create.text
    workspace_id = create.json()["id"]

    invite_email = f"invitee_{uuid.uuid4().hex[:8]}@talkcash.io"
    invite_resp = await client.post(
        f"/api/v1/workspaces/{workspace_id}/invite",
        headers=auth_headers,
        json={"email": invite_email, "role": "member"},
    )
    assert invite_resp.status_code == 200, invite_resp.text
    invite_body = invite_resp.json()
    assert invite_body.get("accept_url")
    token = invite_body["accept_url"].split("token=")[-1]

    register = await client.post("/api/v1/auth/register", json={
        "email": invite_email,
        "password": "testpass123",
        "full_name": "Invitee User",
    })
    assert register.status_code == 200, register.text
    invitee_headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

    inbox = await client.get("/api/v1/workspaces/invitations/inbox", headers=invitee_headers)
    assert inbox.status_code == 200, inbox.text
    assert len(inbox.json()) >= 1

    accept = await client.post(
        "/api/v1/workspaces/invitations/accept",
        headers=invitee_headers,
        json={"token": token},
    )
    assert accept.status_code == 200, accept.text

    workspaces = await client.get("/api/v1/workspaces/", headers=invitee_headers)
    assert workspaces.status_code == 200
    names = [w["name"] for w in workspaces.json()]
    assert "Family Budget" in names
