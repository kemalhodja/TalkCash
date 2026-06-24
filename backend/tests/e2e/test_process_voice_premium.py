import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.config import settings
from app.schemas.common import ParsedInput

FAKE_M4A = b"\x00\x00\x00\x20ftypM4A " + b"\x00" * 16


@pytest.mark.asyncio
async def test_process_voice_free_quota(client: AsyncClient, auth_headers):
    """Free users get 3 voice_expense uses per month."""
    files = {"audio": ("voice.m4a", FAKE_M4A, "audio/m4a")}
    parsed = ParsedInput(intent="add_expense", amount=50.0, category="Market", wallet_name="Nakit")
    with (
        patch("app.routers.input.nlp_engine.transcribe_audio", new_callable=AsyncMock, return_value="50 lira market"),
        patch("app.routers.input.nlp_engine.parse_text", new_callable=AsyncMock, return_value=parsed),
        patch("app.services.execute.service.dispatch_confirmed_action", new_callable=AsyncMock, return_value={"transaction_id": "tx-1"}),
    ):
        for i in range(3):
            resp = await client.post("/api/v1/input/process-voice", headers=auth_headers, files=files)
            assert resp.status_code == 200, f"attempt {i + 1}: {resp.text}"
        blocked = await client.post("/api/v1/input/process-voice", headers=auth_headers, files=files)
    assert blocked.status_code == 402


@pytest.mark.asyncio
async def test_process_voice_premium_success(client: AsyncClient, auth_headers):
    parsed = ParsedInput(intent="add_expense", amount=50.0, category="Market", wallet_name="Nakit")

    with patch.object(settings, "google_play_verify_mock", True):
        upgrade = await client.post(
            "/api/v1/billing/google/verify",
            headers=auth_headers,
            json={"product_id": "talkcash_pro_monthly", "purchase_token": "voice-premium-token"},
        )
        assert upgrade.status_code == 200

    with (
        patch("app.routers.input.nlp_engine.transcribe_audio", new_callable=AsyncMock, return_value="50 lira market"),
        patch("app.routers.input.nlp_engine.parse_text", new_callable=AsyncMock, return_value=parsed),
        patch("app.services.execute.service.dispatch_confirmed_action", new_callable=AsyncMock, return_value={"transaction_id": "tx-1"}),
    ):
        files = {"audio": ("voice.m4a", FAKE_M4A, "audio/m4a")}
        resp = await client.post("/api/v1/input/process-voice", headers=auth_headers, files=files)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "success"
    assert "TalkCash" in body["message"] or "kaydedildi" in body["message"].lower() or "saved" in body["message"].lower()
    assert body["is_premium"] is True
