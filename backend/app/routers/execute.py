from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.i18n import I18nError, resolve_error, t
from app.models.user import User
from app.schemas.common import ParsedInput
from app.schemas.execute import ExecuteRequest
from app.services.agenda.service import AgendaService
from app.services.budget_notify import push_budget_alerts_after_expense
from app.services.shopping.service import ShoppingService
from app.services.social.service import SocialService
from app.services.wallet.service import WalletService
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/execute", tags=["Execute"])
wallet_service = WalletService()
agenda_service = AgendaService()
shopping_service = ShoppingService()
social_service = SocialService()


@router.post("/confirm")
async def execute_confirmed_action(
    body: ExecuteRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.action.confirmed:
        return {"status": "cancelled"}
    await check_rate_limit(request, "execute", settings.execute_rate_limit, identifier=str(user.id), strict=True)
    locale = user.locale or "tr"
    try:
        result = await _dispatch(user.id, body.parsed, db, locale)
        return {"status": "success", "result": result}
    except I18nError as e:
        status = 409 if e.key == "agenda.duplicate_bill" else 400
        raise HTTPException(status_code=status, detail=resolve_error(e, locale))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, locale))


async def _dispatch(user_id: UUID, parsed: ParsedInput, db: AsyncSession, locale: str = "tr") -> dict:
    intent = parsed.intent

    if intent == "add_expense":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        wallet = await wallet_service.find_by_name(db, user_id, parsed.wallet_name or "Nakit")
        if not wallet:
            raise ValueError(t("wallet.not_found", locale))
        receipt_uuid = UUID(parsed.receipt_id) if parsed.receipt_id else None
        category = parsed.category or "Genel"
        tx = await wallet_service.add_expense(
            db, user_id, wallet.id, parsed.amount, category,
            parsed.description or "", parsed.place or "", receipt_id=receipt_uuid,
        )
        await push_budget_alerts_after_expense(db, user_id, category, locale)
        return {"transaction_id": str(tx.id), "amount": float(tx.amount)}

    if intent == "add_income":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        wallet = await wallet_service.find_by_name(db, user_id, parsed.wallet_name or "Banka")
        if not wallet:
            raise ValueError(t("wallet.not_found", locale))
        tx = await wallet_service.add_income(db, user_id, wallet.id, parsed.amount, parsed.description or "")
        return {"wallet": wallet.name, "transaction_id": str(tx.id)}

    if intent == "transfer":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        from_w = await wallet_service.find_by_name(db, user_id, parsed.wallet_name or "Banka")
        to_w = await wallet_service.find_by_name(db, user_id, parsed.target_wallet_name or "Nakit")
        if not from_w or not to_w:
            raise ValueError(t("wallet.not_found", locale))
        await wallet_service.transfer(db, user_id, from_w.id, to_w.id, parsed.amount)
        return {"from": from_w.name, "to": to_w.name, "amount": float(parsed.amount)}

    if intent == "add_shopping":
        items = parsed.items or ([parsed.description] if parsed.description else [])
        if not items:
            raise ValueError(t("execute.item_required", locale))
        created = await shopping_service.add_items(db, user_id, items)
        return {"added": [i.name for i in created]}

    if intent == "mark_paid":
        wallet_id = None
        if parsed.wallet_name:
            w = await wallet_service.find_by_name(db, user_id, parsed.wallet_name)
            wallet_id = w.id if w else None
        item = await agenda_service.mark_paid(db, user_id, parsed.description or "", wallet_id)
        return {"title": item.title, "status": item.status.value}

    if intent == "add_bill":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        due = parsed.date or (datetime.utcnow() + timedelta(days=7))
        item = await agenda_service.add_bill(
            db, user_id, parsed.description or parsed.category or "Fatura",
            parsed.amount, due, is_recurring=parsed.is_recurring, force=parsed.force,
        )
        return {
            "id": str(item.id), "title": item.title,
            "due_date": item.due_date.isoformat(), "amount": float(item.amount),
        }

    if intent == "add_installment":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        items = await agenda_service.create_installments(
            db, user_id, parsed.description or "Taksit",
            parsed.amount, parsed.installment_count or 6,
        )
        return {"installments": len(items), "per_month": float(items[0].amount)}

    if intent == "add_debt":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        is_lent = not any(
            phrase in (parsed.raw_text or "").lower()
            for phrase in ("aldım", "borç aldım", "borrowed", "i owe", "i borrowed")
        )
        record = await social_service.add_debt(db, user_id, parsed.person_name or "?", parsed.amount, is_lent)
        return {"person": record.person_name, "amount": float(record.amount)}

    if intent == "split_bill":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        count = parsed.person_count or 2
        bill = await social_service.split_bill(db, user_id, parsed.amount, count)
        return {"per_person": float(bill.per_person), "message": bill.share_message}

    raise ValueError(t("execute.unsupported_intent", locale, intent=intent))
