from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.i18n import SUPPORTED_LOCALES, locale_from_request, resolve_error, t
from app.schemas.auth import LocaleRequest, LoginRequest, PinRequest, RegisterRequest, TokenResponse, UserProfile
from app.services.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])
auth_service = AuthService()


def _token_response(user: User, token: str) -> TokenResponse:
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        full_name=user.full_name,
        biometric_enabled=user.biometric_enabled,
        has_pin=bool(user.pin_code),
        locale=user.locale or "tr",
    )


@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    lang = locale_from_request(request)
    try:
        user, token = await auth_service.register(db, data.email, data.password, data.full_name)
        return _token_response(user, token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, lang))


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    lang = locale_from_request(request)
    try:
        user, token = await auth_service.login(db, data.email, data.password)
        return _token_response(user, token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=resolve_error(e, lang))


@router.get("/me", response_model=UserProfile)
async def me(user: User = Depends(get_current_user)):
    return UserProfile(
        id=user.id, email=user.email, full_name=user.full_name,
        biometric_enabled=user.biometric_enabled, has_pin=bool(user.pin_code),
        locale=user.locale or "tr",
    )


@router.post("/pin")
async def set_pin(data: PinRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if len(data.pin) < 4:
        raise HTTPException(status_code=400, detail=t("auth.pin_too_short", user.locale or "tr"))
    await auth_service.set_pin(db, user.id, data.pin)
    return {"status": "ok"}


@router.post("/pin/verify")
async def verify_pin(data: PinRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    valid = await auth_service.verify_pin(db, user.id, data.pin)
    if not valid:
        raise HTTPException(status_code=401, detail=t("auth.pin_invalid", user.locale or "tr"))
    return {"status": "ok"}


@router.post("/biometric")
async def toggle_biometric(enabled: bool, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await auth_service.toggle_biometric(db, user.id, enabled)
    return {"biometric_enabled": enabled}


@router.put("/locale")
async def set_locale(data: LocaleRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if data.locale not in SUPPORTED_LOCALES:
        raise HTTPException(status_code=400, detail=f"Supported: {SUPPORTED_LOCALES}")
    await auth_service.set_locale(db, user.id, data.locale)
    return {"locale": data.locale}
