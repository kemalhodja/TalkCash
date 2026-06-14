from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.config import settings
from app.i18n import SUPPORTED_LOCALES, I18nError, locale_from_request, resolve_error, t
from app.schemas.auth import (
    DeleteAccountRequest,
    LocaleRequest,
    LoginRequest,
    PasswordChangeRequest,
    PinChangeRequest,
    PinRequest,
    RefreshRequest,
    RegisterRequest,
    TimezoneRequest,
    TokenResponse,
    UserProfile,
)
from app.services.auth.service import AuthService
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/auth", tags=["Auth"])
auth_service = AuthService()


def _token_response(user: User, access: str, refresh: str) -> TokenResponse:
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user_id=user.id,
        full_name=user.full_name,
        biometric_enabled=user.biometric_enabled,
        has_pin=bool(user.pin_code),
        locale=user.locale or "tr",
        timezone=user.timezone or "Europe/Istanbul",
    )


@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await check_rate_limit(request, "auth", settings.auth_rate_limit, strict=True)
    lang = locale_from_request(request)
    try:
        user, access, refresh = await auth_service.register(db, data.email, data.password, data.full_name)
        return _token_response(user, access, refresh)
    except I18nError as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, lang))


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await check_rate_limit(request, "auth", settings.auth_rate_limit, strict=True)
    lang = locale_from_request(request)
    try:
        user, access, refresh = await auth_service.login(db, data.email, data.password)
        return _token_response(user, access, refresh)
    except I18nError as e:
        raise HTTPException(status_code=401, detail=resolve_error(e, lang))


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await check_rate_limit(request, "auth", settings.auth_rate_limit, strict=True)
    lang = locale_from_request(request)
    try:
        user, access, refresh = await auth_service.refresh(db, data.refresh_token)
        return _token_response(user, access, refresh)
    except I18nError as e:
        raise HTTPException(status_code=401, detail=resolve_error(e, lang))


@router.post("/logout")
async def logout(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.revoke_refresh_token(db, data.refresh_token)
    return {"status": "ok"}


@router.get("/me", response_model=UserProfile)
async def me(user: User = Depends(get_current_user)):
    return UserProfile(
        id=user.id, email=user.email, full_name=user.full_name,
        biometric_enabled=user.biometric_enabled, has_pin=bool(user.pin_code),
        locale=user.locale or "tr",
        timezone=user.timezone or "Europe/Istanbul",
    )


@router.post("/pin")
async def set_pin(data: PinRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if len(data.pin) < 4:
        raise HTTPException(status_code=400, detail=t("auth.pin_too_short", user.locale or "tr"))
    await auth_service.set_pin(db, user.id, data.pin)
    return {"status": "ok"}


@router.put("/pin")
async def change_pin(
    data: PinChangeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user.locale or "tr"
    try:
        await auth_service.change_pin(db, user.id, data.current_pin, data.new_pin)
        return {"status": "ok"}
    except I18nError as e:
        raise HTTPException(status_code=401, detail=resolve_error(e, lang))


@router.post("/pin/verify")
async def verify_pin(
    data: PinRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, "pin", 15, strict=True)
    valid = await auth_service.verify_pin(db, user.id, data.pin)
    if not valid:
        raise HTTPException(status_code=401, detail=t("auth.pin_invalid", user.locale or "tr"))
    return {"status": "ok"}


@router.put("/password")
async def change_password(
    data: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user.locale or "tr"
    try:
        await auth_service.change_password(db, user.id, data.current_password, data.new_password)
        return {"status": "ok"}
    except I18nError as e:
        raise HTTPException(status_code=401, detail=resolve_error(e, lang))


@router.delete("/me")
async def delete_account(
    data: DeleteAccountRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user.locale or "tr"
    try:
        await auth_service.delete_account(db, user.id, data.password)
        return {"status": "deleted"}
    except I18nError as e:
        raise HTTPException(status_code=401, detail=resolve_error(e, lang))


@router.post("/biometric")
async def toggle_biometric(enabled: bool, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await auth_service.toggle_biometric(db, user.id, enabled)
    return {"biometric_enabled": enabled}


@router.put("/locale")
async def set_locale(data: LocaleRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if data.locale not in SUPPORTED_LOCALES:
        raise HTTPException(status_code=400, detail=t("auth.unsupported_locale", user.locale or "tr"))
    await auth_service.set_locale(db, user.id, data.locale)
    return {"locale": data.locale}


@router.put("/timezone")
async def set_timezone(data: TimezoneRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    try:
        ZoneInfo(data.timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=400, detail=t("auth.invalid_timezone", user.locale or "tr"))
    await auth_service.set_timezone(db, user.id, data.timezone)
    return {"timezone": data.timezone}
