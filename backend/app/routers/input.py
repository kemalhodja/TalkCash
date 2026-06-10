from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.common import ConfirmationCard
from app.services.nlp import nlp_engine
from app.utils.redis_client import cache_get, cache_set

router = APIRouter(prefix="/input", tags=["Data Input"])

DEFAULT_SUGGESTIONS = {
    "m": ["Market", "Mutfak", "Migros"],
    "k": ["Kahve", "Kira", "Kredi Kartı"],
    "e": ["Ekmek", "Elektrik", "Et"],
    "s": ["Süt", "Su", "Starbucks"],
}


@router.post("/parse", response_model=ConfirmationCard)
async def parse_text(text: str, whisper_mode: bool = False, user: User = Depends(get_current_user)):
    parsed = await nlp_engine.parse_text(text, whisper_mode=whisper_mode)
    message = nlp_engine.build_confirmation(parsed)
    return ConfirmationCard(message=message, parsed=parsed)


@router.post("/voice", response_model=ConfirmationCard)
async def parse_voice(
    audio: UploadFile = File(...), whisper_mode: bool = False,
    user: User = Depends(get_current_user),
):
    audio_bytes = await audio.read()
    text = await nlp_engine.transcribe_audio(audio_bytes, whisper_mode=whisper_mode)
    parsed = await nlp_engine.parse_text(text, whisper_mode=whisper_mode)
    message = nlp_engine.build_confirmation(parsed)
    return ConfirmationCard(message=message, parsed=parsed)


@router.post("/slash", response_model=ConfirmationCard)
async def parse_slash_command(command: str, user: User = Depends(get_current_user)):
    parsed = await nlp_engine.parse_text(command)
    message = nlp_engine.build_confirmation(parsed)
    return ConfirmationCard(message=message, parsed=parsed)


@router.get("/autocomplete")
async def autocomplete(
    query: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"autocomplete:{user.id}:{query.lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return {"suggestions": cached}

    cat_result = await db.execute(
        select(distinct(Transaction.category)).where(Transaction.user_id == user.id).limit(30)
    )
    desc_result = await db.execute(
        select(distinct(Transaction.description)).where(Transaction.user_id == user.id).limit(30)
    )
    user_words: set[str] = set()
    for row in cat_result.all() + desc_result.all():
        val = row[0]
        if val and len(val) > 1:
            user_words.add(val)

    first_char = query[0].lower() if query else ""
    base = list(user_words) + DEFAULT_SUGGESTIONS.get(first_char, [])
    filtered = [s for s in base if s.lower().startswith(query.lower())]
    suggestions = list(dict.fromkeys(filtered))[:8] or DEFAULT_SUGGESTIONS.get(first_char, [])

    await cache_set(cache_key, suggestions, ttl=300)
    return {"suggestions": suggestions}
