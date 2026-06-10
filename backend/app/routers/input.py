from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.common import ConfirmationCard, ParsedInput
from app.services.nlp import nlp_engine

router = APIRouter(prefix="/input", tags=["Data Input"])


@router.post("/parse", response_model=ConfirmationCard)
async def parse_text(text: str, whisper_mode: bool = False):
    parsed = await nlp_engine.parse_text(text, whisper_mode=whisper_mode)
    message = nlp_engine.build_confirmation(parsed)
    return ConfirmationCard(message=message, parsed=parsed)


@router.post("/voice", response_model=ConfirmationCard)
async def parse_voice(audio: UploadFile = File(...), whisper_mode: bool = False):
    audio_bytes = await audio.read()
    text = await nlp_engine.transcribe_audio(audio_bytes, whisper_mode=whisper_mode)
    parsed = await nlp_engine.parse_text(text, whisper_mode=whisper_mode)
    message = nlp_engine.build_confirmation(parsed)
    return ConfirmationCard(message=message, parsed=parsed)


@router.post("/slash")
async def parse_slash_command(command: str):
    """Slash command: /150 kahve banka"""
    parsed = await nlp_engine.parse_text(command)
    message = nlp_engine.build_confirmation(parsed)
    return ConfirmationCard(message=message, parsed=parsed)


@router.get("/autocomplete")
async def autocomplete(query: str, user_id: str | None = None):
    suggestions = {
        "m": ["Market", "Mutfak", "Migros"],
        "k": ["Kahve", "Kira", "Kredi Kartı"],
        "e": ["Ekmek", "Elektrik", "Et"],
        "s": ["Süt", "Su", "Starbucks"],
    }
    first_char = query[0].lower() if query else ""
    base = suggestions.get(first_char, [])
    filtered = [s for s in base if s.lower().startswith(query.lower())]
    return {"suggestions": filtered or base}
