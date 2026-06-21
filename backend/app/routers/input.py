from pydantic import BaseModel
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, user_locale, verify_premium_status
from app.i18n import resolve_error, t
from app.models.billing import Subscription
from app.models.transaction import Transaction
from app.models.user import User
from app.services.execute.service import dispatch_confirmed_action
from app.schemas.common import ConfirmationCard
from app.services.nlp import nlp_engine
from app.utils.rate_limit import check_rate_limit
from app.utils.redis_client import cache_get, cache_set
from app.utils.validation import validate_audio_bytes, validate_image_bytes

router = APIRouter(prefix="/input", tags=["Data Input"])


@router.get("/capabilities")
async def input_capabilities(user: User = Depends(get_current_user)):
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
    await check_rate_limit(request, "input", settings.input_rate_limit, identifier=str(user.id), strict=True)
    lang = user_locale(user)
    parsed = await nlp_engine.parse_text(text, whisper_mode=whisper_mode, locale=lang, persona=user.assistant_persona or "default")
    message = nlp_engine.build_confirmation(parsed, lang)
    return ConfirmationCard(message=message, parsed=parsed)


@router.post("/voice", response_model=ConfirmationCard)
async def parse_voice(
    request: Request,
    audio: UploadFile = File(...),
    whisper_mode: bool = False,
    user: User = Depends(get_current_user),
):
    await check_rate_limit(request, "voice", settings.voice_rate_limit, identifier=str(user.id), strict=True)
    lang = user_locale(user)
    try:
        audio_bytes = await audio.read()
        validate_audio_bytes(audio_bytes, settings.ocr_max_upload_bytes)
        text = await nlp_engine.transcribe_audio(audio_bytes, whisper_mode=whisper_mode, locale=lang)
        parsed = await nlp_engine.parse_text(text, whisper_mode=whisper_mode, locale=lang, persona=user.assistant_persona or "default")
        message = nlp_engine.build_confirmation(parsed, lang)
        return ConfirmationCard(message=message, parsed=parsed)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, lang))


@router.post("/transcribe")
async def transcribe_only(
    request: Request,
    audio: UploadFile = File(...),
    whisper_mode: bool = False,
    user: User = Depends(get_current_user),
):
    """Lightweight STT for quick yes/no voice prompts."""
    await check_rate_limit(request, "voice", settings.voice_rate_limit, identifier=str(user.id), strict=True)
    lang = user_locale(user)
    try:
        audio_bytes = await audio.read()
        validate_audio_bytes(audio_bytes, settings.ocr_max_upload_bytes)
        text = await nlp_engine.transcribe_audio(audio_bytes, whisper_mode=whisper_mode, locale=lang)
        return {"text": text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, lang))


@router.post("/process-voice")
async def process_voice_transaction(
    request: Request,
    audio: UploadFile = File(...),
    whisper_mode: bool = False,
    user: User = Depends(get_current_user),
    subscription: Subscription = Depends(verify_premium_status),
    db: AsyncSession = Depends(get_db),
):
    """Premium: transcribe voice, parse intent, and save to TalkCash in one step."""
    await check_rate_limit(request, "voice", settings.voice_rate_limit, identifier=str(user.id), strict=True)
    lang = user_locale(user)
    try:
        audio_bytes = await audio.read()
        validate_audio_bytes(audio_bytes, settings.ocr_max_upload_bytes)
        text = await nlp_engine.transcribe_audio(audio_bytes, whisper_mode=whisper_mode, locale=lang)
        parsed = await nlp_engine.parse_text(text, whisper_mode=whisper_mode, locale=lang, persona=user.assistant_persona or "default")
        if parsed.intent == "manual_edit" or parsed.parse_failed:
            return {
                "status": "needs_confirmation",
                "message": nlp_engine.build_confirmation(parsed, lang),
                "is_premium": subscription.is_premium,
                "transcript": text,
                "parsed": parsed.model_dump(mode="json"),
            }
        if parsed.intent == "easter_egg":
            return {
                "status": "easter_egg",
                "message": parsed.description or t("nlp.easter_egg", lang),
                "is_premium": subscription.is_premium,
                "transcript": text,
                "parsed": parsed.model_dump(mode="json"),
            }
        result = await dispatch_confirmed_action(user.id, parsed, db, lang)
        payload = {
            "status": "success",
            "message": t("input.voice_processed_success", lang),
            "is_premium": subscription.is_premium,
            "transcript": text,
            "parsed": parsed.model_dump(mode="json"),
            "result": result,
        }
        if result.get("voice_alert"):
            payload["voice_alert"] = result["voice_alert"]
        if result.get("persona_speech"):
            payload["persona_speech"] = result["persona_speech"]
        if result.get("subscription_alert"):
            payload["subscription_alert"] = result["subscription_alert"]
        return payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, lang))


@router.post("/quick-voice")
async def quick_voice_expense(
    request: Request,
    audio: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lock-screen / widget: transcribe, save expense, return notification payload."""
    await check_rate_limit(request, "voice", settings.voice_rate_limit, identifier=str(user.id), strict=True)
    lang = user_locale(user)
    try:
        audio_bytes = await audio.read()
        validate_audio_bytes(audio_bytes, settings.ocr_max_upload_bytes)
        text = await nlp_engine.transcribe_audio(audio_bytes, whisper_mode=True, locale=lang)
        parsed = await nlp_engine.parse_text(
            text, whisper_mode=True, locale=lang, persona=user.assistant_persona or "default",
        )
        if parsed.intent not in ("add_expense", "manual_edit") or parsed.parse_failed or not parsed.amount:
            return {
                "status": "needs_confirmation",
                "transcript": text,
                "message": nlp_engine.build_confirmation(parsed, lang),
            }
        if parsed.intent == "manual_edit":
            parsed = parsed.model_copy(update={"intent": "add_expense"})
        result = await dispatch_confirmed_action(user.id, parsed, db, lang)
        title = t("quick_voice.saved_title", lang)
        body = t("quick_voice.saved_body", lang, amount=f"{float(parsed.amount):.2f}", description=parsed.description or parsed.category or "")
        return {
            "status": "success",
            "transcript": text,
            "notification_title": title,
            "notification_body": body,
            "result": result,
            "voice_alert": result.get("voice_alert"),
            "persona_speech": result.get("persona_speech"),
            "subscription_alert": result.get("subscription_alert"),
        }
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
    await check_rate_limit(request, "input", settings.input_rate_limit, identifier=str(user.id), strict=True)
    lang = user_locale(user)
    parsed = await nlp_engine.parse_text(command, locale=lang, persona=user.assistant_persona or "default")
    message = nlp_engine.build_confirmation(parsed, lang)
    return ConfirmationCard(message=message, parsed=parsed)


class SmsParseRequest(BaseModel):
    text: str


@router.post("/parse-sms", response_model=ConfirmationCard)
async def parse_sms(
    body: SmsParseRequest,
    request: Request,
    user: User = Depends(get_current_user),
):
    await check_rate_limit(request, "input", settings.input_rate_limit, identifier=str(user.id), strict=True)
    lang = user_locale(user)
    parsed = await nlp_engine.parse_sms(body.text.strip(), locale=lang, persona=user.assistant_persona or "default")
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
