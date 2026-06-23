"""Speech-to-text: Groq Whisper (preferred) or OpenAI Whisper fallback."""

from __future__ import annotations

from groq import AsyncGroq
from openai import AsyncOpenAI

from app.config import settings
from app.i18n import I18nError


def stt_available() -> bool:
    return bool(settings.groq_api_key or settings.openai_api_key)


async def transcribe_audio(audio_bytes: bytes, *, whisper_mode: bool = False, locale: str = "tr") -> str:
    if settings.groq_api_key:
        return await _transcribe_groq(audio_bytes, whisper_mode=whisper_mode, locale=locale)
    if settings.openai_api_key:
        return await _transcribe_openai(audio_bytes, whisper_mode=whisper_mode, locale=locale)
    raise I18nError("nlp.stt_required")


async def _transcribe_groq(audio_bytes: bytes, *, whisper_mode: bool, locale: str) -> str:
    client = AsyncGroq(api_key=settings.groq_api_key)
    lang = "en" if locale == "en" else "tr"
    kwargs: dict = {
        "model": settings.groq_whisper_model,
        "file": ("audio.m4a", audio_bytes),
        "language": lang,
    }
    if whisper_mode:
        kwargs["prompt"] = (
            "quiet whisper speech, Turkish financial terms"
            if locale == "tr"
            else "quiet whisper speech, English financial terms"
        )
        kwargs["temperature"] = 0.2
    response = await client.audio.transcriptions.create(**kwargs)
    return response.text


async def _transcribe_openai(audio_bytes: bytes, *, whisper_mode: bool, locale: str) -> str:
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    lang = "en" if locale == "en" else "tr"
    kwargs: dict = {
        "model": settings.whisper_model,
        "file": ("audio.m4a", audio_bytes),
        "language": lang,
    }
    if whisper_mode:
        kwargs["prompt"] = (
            "quiet whisper speech, Turkish financial terms"
            if locale == "tr"
            else "quiet whisper speech"
        )
        kwargs["temperature"] = 0.2
    response = await client.audio.transcriptions.create(**kwargs)
    return response.text
