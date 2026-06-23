from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.i18n import I18nError
from app.services.nlp.stt import stt_available, transcribe_audio


def test_stt_available_groq_only():
    with patch("app.services.nlp.stt.settings") as mock_settings:
        mock_settings.groq_api_key = "gsk_test"
        mock_settings.openai_api_key = ""
        assert stt_available() is True


def test_stt_available_none():
    with patch("app.services.nlp.stt.settings") as mock_settings:
        mock_settings.groq_api_key = ""
        mock_settings.openai_api_key = ""
        assert stt_available() is False


@pytest.mark.asyncio
async def test_transcribe_prefers_groq():
    with patch("app.services.nlp.stt.settings") as mock_settings:
        mock_settings.groq_api_key = "gsk_test"
        mock_settings.openai_api_key = "sk_test"
        mock_settings.groq_whisper_model = "whisper-large-v3-turbo"
        with patch("app.services.nlp.stt._transcribe_groq", new_callable=AsyncMock, return_value="50 lira kahve") as groq_mock:
            text = await transcribe_audio(b"audio", locale="tr")
    assert text == "50 lira kahve"
    groq_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_transcribe_openai_fallback():
    with patch("app.services.nlp.stt.settings") as mock_settings:
        mock_settings.groq_api_key = ""
        mock_settings.openai_api_key = "sk_test"
        mock_settings.whisper_model = "whisper-1"
        with patch("app.services.nlp.stt._transcribe_openai", new_callable=AsyncMock, return_value="coffee") as openai_mock:
            text = await transcribe_audio(b"audio", locale="en")
    assert text == "coffee"
    openai_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_transcribe_requires_key():
    with patch("app.services.nlp.stt.settings") as mock_settings:
        mock_settings.groq_api_key = ""
        mock_settings.openai_api_key = ""
        with pytest.raises(I18nError):
            await transcribe_audio(b"audio")


@pytest.mark.asyncio
async def test_input_capabilities_with_groq():
    from app.routers.input import input_capabilities

    user = MagicMock()
    with patch("app.routers.input.settings") as mock_settings:
        mock_settings.openai_api_key = ""
        mock_settings.groq_api_key = "gsk_test"
        mock_settings.google_vision_api_key = ""
        result = await input_capabilities(user)
    assert result["voice_available"] is True
    assert result["llm_available"] is False
