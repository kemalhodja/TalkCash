"""Health endpoint observability fields."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_includes_observability():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code in (200, 503)
    body = resp.json()
    assert "observability" in body
    obs = body["observability"]
    assert "version" in obs
    assert "uptime_seconds" in obs
    assert "region" in obs
    assert resp.headers.get("X-Request-ID")
    assert resp.headers.get("X-Response-Time-Ms")

    readiness = body["launch_readiness"]
    assert "apple_configured" in readiness
