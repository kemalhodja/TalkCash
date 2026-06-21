from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_premium, user_locale
from app.i18n import resolve_error
from app.models.billing import Subscription
from app.models.user import User
from app.schemas.micro_savings import MicroSavingsPrefsUpdate, MicroSavingsSimulateRequest, MicroSavingsTransferRequest
from app.services.micro_savings.brokers import broker_by_id, build_broker_open_url, list_brokers
from app.services.micro_savings.rates import simulate_growth
from app.services.micro_savings.prefs import (
    ALLOWED_BROKERS,
    ALLOWED_INVESTMENT_WALLETS,
    ALLOWED_ROUND_UP_STEPS,
    get_user_micro_savings_prefs,
    serialize_micro_savings_prefs,
)
from app.services.micro_savings.service import MicroSavingsService
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/micro-savings", tags=["Micro Savings"])
service = MicroSavingsService()


def _transfer_http_error(e: Exception, locale: str) -> HTTPException:
    from app.services.billing.service import EntitlementError

    if isinstance(e, EntitlementError):
        return HTTPException(
            status_code=402,
            detail={"code": "premium_required", "entitlement": e.key},
        )
    return HTTPException(status_code=400, detail=resolve_error(e, locale))


@router.get("/prefs")
async def get_prefs(user: User = Depends(get_current_user)):
    return get_user_micro_savings_prefs(user)


@router.patch("/prefs")
async def update_prefs(
    body: MicroSavingsPrefsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prefs = get_user_micro_savings_prefs(user)
    updates = body.model_dump(exclude_unset=True)
    if "round_up_step" in updates and updates["round_up_step"] not in ALLOWED_ROUND_UP_STEPS:
        raise HTTPException(status_code=400, detail="Invalid round_up_step")
    if "preferred_broker" in updates and updates["preferred_broker"] not in ALLOWED_BROKERS:
        raise HTTPException(status_code=400, detail="Invalid preferred_broker")
    if "default_investment_wallet" in updates and updates["default_investment_wallet"] not in ALLOWED_INVESTMENT_WALLETS:
        raise HTTPException(status_code=400, detail="Invalid default_investment_wallet")
    if updates.get("auto_round_up") is True:
        from app.services.billing.service import BillingService, PremiumRequiredError

        try:
            await BillingService().verify_premium_status(db, user.id)
        except PremiumRequiredError:
            raise HTTPException(status_code=402, detail={"code": "premium_required", "entitlement": "portfolio_coach"})
    prefs.update(updates)
    user.micro_savings_prefs = serialize_micro_savings_prefs(prefs)
    await db.commit()
    await db.refresh(user)
    return prefs


@router.get("/brokers")
async def brokers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    amount: float | None = None,
):
    locale = user_locale(user)
    catalog = list_brokers(locale)
    prefs = get_user_micro_savings_prefs(user)
    ref_amount = amount
    if ref_amount is None:
        summary = await service.get_summary(db, user.id)
        ref_amount = summary.get("week_saved") or summary.get("month_saved")
    preferred = broker_by_id(
        prefs.get("preferred_broker", "midas"),
        locale,
        amount_try=ref_amount if ref_amount and ref_amount > 0 else None,
    )
    if ref_amount and ref_amount > 0:
        catalog = [
            {**b, "open_url": build_broker_open_url(b, amount_try=ref_amount, locale=locale)}
            for b in catalog
        ]
    return {"brokers": catalog, "preferred": preferred, "ref_amount": ref_amount}


@router.get("/rates")
async def live_rates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    summary = await service.get_summary(db, user.id)
    return {
        "live_rates": summary.get("live_rates"),
        "equivalents": summary.get("equivalents"),
        "investment_total": summary.get("investment_total"),
    }


@router.post("/simulate")
async def simulate_investment(
    body: MicroSavingsSimulateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(
        request, "micro_savings", settings.micro_savings_rate_limit, identifier=str(user.id), strict=True,
    )
    locale = user_locale(user)
    summary = await service.get_summary(db, user.id)
    starting = body.starting_balance if body.starting_balance > 0 else float(summary.get("investment_total") or 0)
    monthly = body.monthly_contribution
    if monthly <= 0 and summary.get("month_saved"):
        monthly = float(summary["month_saved"])
    if monthly <= 0 and summary.get("week_saved"):
        monthly = float(summary["week_saved"]) * 4
    if monthly <= 0:
        monthly = 100.0
    result = simulate_growth(monthly, body.months, starting, body.annual_return)
    from app.i18n import t

    result["disclaimer"] = t("micro_savings.simulation_disclaimer", locale)
    return result


@router.get("/opportunity")
async def swap_opportunity(
    amount: float,
    description: str = "",
    category: str = "Genel",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    locale = user_locale(user)
    nudge = await service.build_nudge(
        db, user.id, description, category, Decimal(str(amount)), None, locale,
    )
    if not nudge:
        return {"has_opportunity": False}
    return {"has_opportunity": True, "swap_nudge": nudge}


@router.post("/transfer")
async def transfer_savings(
    body: MicroSavingsTransferRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(
        request, "micro_savings", settings.micro_savings_rate_limit, identifier=str(user.id), strict=True,
    )
    locale = user_locale(user)
    try:
        result = await service.transfer_savings(
            db,
            user.id,
            body.from_wallet_id,
            body.to_wallet_id,
            Decimal(str(body.amount)),
            body.rule_key,
            locale,
        )
        return {"status": "success", **result}
    except Exception as e:
        raise _transfer_http_error(e, locale) from e


@router.get("/summary")
async def savings_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_summary(db, user.id, include_projection=False)


@router.get("/summary/premium")
async def savings_summary_premium(
    _subscription: Subscription = Depends(require_premium()),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_premium_insights(db, user.id, user_locale(user))


@router.get("/portfolio")
async def portfolio_coach(
    _subscription: Subscription = Depends(require_premium()),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.micro_savings.portfolio import PortfolioCoachService

    return await PortfolioCoachService().analyze(db, user.id, user_locale(user))
