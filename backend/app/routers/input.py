from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error, t
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.common import ConfirmationCard
from app.services.nlp import nlp_engine
from app.utils.rate_limit import check_rate_limit
from app.utils.redis_client import cache_get, cache_set

router = APIRouter(prefix="/input", tags=["Data Input"])


@router.get("/capabilities")
async def input_capabilities():
    ai = bool(settings.openai_api_key)
    return {
        "voice_available": ai,
        "llm_available": ai,
        "ocr_tesseract": True,
        "ocr_google_vision": bool(settings.google_vision_api_key),
    }

DEFAULT_SUGGESTIONS_TR = {
    "m": ["Market", "Mutfak", "Migros"],
    "k": ["Kahve", "Kira", "Kredi Kartı"],
    "e": ["Ekmek", "Elektrik", "Et"],
    "s": ["Süt", "Su", "Starbucks"],
}

DEFAULT_SUGGESTIONS_EN = {
    "m": ["Market", "Mortgage", "Metro"],
    "k": ["Coffee", "Rent", "Credit Card"],
    "e": ["Eggs", "Electricity", "Eating out"],
    "s": ["Salary", "Shopping", "Starbucks"],
}


@router.post("/parse", response_model=ConfirmationCard)
async def parse_text(
    text: str,
    request: Request,
    whisper_mode: bool = False,
    user: User = Depends(get_current_user),
):
    await check_rate_limit(request, "input", settings.input_rate_limit, identifier=str(user.id))
    lang = user_locale(user)
    parsed = await nlp_engine.parse_text(text, whisper_mode=whisper_mode, locale=lang)
    message = nlp_engine.build_confirmation(parsed, lang)
    return ConfirmationCard(message=message, parsed=parsed)


@router.post("/voice", response_model=ConfirmationCard)
async def parse_voice(
    request: Request,
    audio: UploadFile = File(...),
    whisper_mode: bool = False,
    user: User = Depends(get_current_user),
):
    await check_rate_limit(request, "voice", settings.voice_rate_limit, identifier=str(user.id))
    lang = user_locale(user)
    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) > settings.ocr_max_upload_bytes:
            raise HTTPException(status_code=413, detail=t("input.file_too_large", lang))
        text = await nlp_engine.transcribe_audio(audio_bytes, whisper_mode=whisper_mode, locale=lang)
        parsed = await nlp_engine.parse_text(text, whisper_mode=whisper_mode, locale=lang)
        message = nlp_engine.build_confirmation(parsed, lang)
        return ConfirmationCard(message=message, parsed=parsed)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, lang))


@router.post("/slash", response_model=ConfirmationCard)
async def parse_slash_command(
    command: str,
    request: Request,
    user: User = Depends(get_current_user),
):
    await check_rate_limit(request, "input", settings.input_rate_limit, identifier=str(user.id))
    lang = user_locale(user)
    parsed = await nlp_engine.parse_text(command, locale=lang)
    message = nlp_engine.build_confirmation(parsed, lang)
    return ConfirmationCard(message=message, parsed=parsed)


@router.get("/autocomplete")
async def autocomplete(
    query: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    defaults = DEFAULT_SUGGESTIONS_EN if lang == "en" else DEFAULT_SUGGESTIONS_TR
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
    base = list(user_words) + defaults.get(first_char, [])
    filtered = [s for s in base if s.lower().startswith(query.lower())]
    suggestions = list(dict.fromkeys(filtered))[:8] or defaults.get(first_char, [])

    await cache_set(cache_key, suggestions, ttl=300)
    return {"suggestions": suggestions}
