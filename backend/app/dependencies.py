from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.i18n import t
from app.models.billing import Subscription
from app.models.user import User
from app.services.billing.service import BillingService, EntitlementError, PremiumRequiredError
from app.utils.security import decode_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="auth.invalid_token")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="auth.user_not_found")
    return user


def user_locale(user: User) -> str:
    return user.locale if user.locale in ("tr", "en") else "tr"


def require_entitlement(key: str):
    async def dependency(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> None:
        try:
            await BillingService().require_entitlement(db, user.id, key)
        except EntitlementError:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={"code": "premium_required", "entitlement": key},
            )

    return dependency


async def verify_premium_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    billing = BillingService()
    lang = user_locale(user)
    try:
        return await billing.verify_premium_status(db, user.id)
    except PremiumRequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=t(f"billing.{exc.code}", lang),
        )


def require_premium():
    """FastAPI dependency — premium-only endpoints (403 if not premium or expired)."""

    async def dependency(subscription: Subscription = Depends(verify_premium_status)) -> Subscription:
        return subscription

    return dependency
