import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_premium, user_locale
from app.i18n import resolve_error
from app.models.billing import PlanTier
from app.models.user import User
from app.schemas.billing import (
    GoogleVerifyRequest,
    GoogleVerifyResponse,
    PremiumStatusResponse,
    ProductCatalogItem,
    ProductCatalogResponse,
    UpgradeRequest,
    UpgradeResponse,
)
from app.services.billing.service import BillingService

router = APIRouter(prefix="/billing", tags=["Billing"])
billing_service = BillingService()


def _allow_internal_upgrade(request: Request) -> None:
    if settings.debug:
        return
    secret = settings.internal_upgrade_secret.strip()
    header = request.headers.get("x-internal-upgrade-secret", "")
    if secret and header == secret:
        return
    raise HTTPException(status_code=404, detail="Not found")


@router.get("/me", response_model=PremiumStatusResponse)
async def premium_status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await billing_service.get_status(db, user.id)


@router.get("/premium-check")
async def premium_check(subscription=Depends(require_premium())):
    return {"status": "ok", "is_premium": subscription.is_premium}


@router.get("/products", response_model=ProductCatalogResponse)
async def product_catalog(user: User = Depends(get_current_user)):
    products = [
        ProductCatalogItem(product_id=item["product_id"], plan=PlanTier(item["plan"]), name=item["name"])
        for item in billing_service.google_product_catalog()
    ]
    return ProductCatalogResponse(products=products, package_name=settings.google_play_package_name)


@router.post("/google/verify", response_model=GoogleVerifyResponse)
async def verify_google_purchase(
    data: GoogleVerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    try:
        verified = await asyncio.to_thread(
            billing_service.google_play.verify_subscription,
            data.product_id,
            data.purchase_token,
        )
        subscription = await billing_service.activate_google_subscription(db, user.id, verified)
        return GoogleVerifyResponse(
            subscription_id=subscription.id,
            status=await billing_service.get_status(db, user.id),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=resolve_error(exc, lang))


@router.post("/internal-upgrade", response_model=UpgradeResponse)
async def internal_upgrade(
    request: Request,
    data: UpgradeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _allow_internal_upgrade(request)
    try:
        subscription = await billing_service.set_internal_plan(db, user.id, data.plan)
        return UpgradeResponse(
            subscription_id=subscription.id,
            status=await billing_service.get_status(db, user.id),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=resolve_error(exc, user_locale(user)))
