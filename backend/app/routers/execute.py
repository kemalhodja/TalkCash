from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.common import ParsedInput
from app.schemas.execute import ExecuteRequest
from app.services.agenda.service import AgendaService
from app.services.shopping.service import ShoppingService
from app.services.social.service import SocialService
from app.services.wallet.service import WalletService

router = APIRouter(prefix="/execute", tags=["Execute"])
wallet_service = WalletService()
agenda_service = AgendaService()
shopping_service = ShoppingService()
social_service = SocialService()


@router.post("/confirm")
async def execute_confirmed_action(
    body: ExecuteRequest,
    db: AsyncSession = Depends(get_db),
):
    if not body.action.confirmed:
        return {"status": "cancelled"}

    try:
        result = await _dispatch(body.user_id, body.parsed, db)
        return {"status": "success", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def _dispatch(user_id: UUID, parsed: ParsedInput, db: AsyncSession) -> dict:
    intent = parsed.intent

    if intent == "add_expense":
        wallet = await wallet_service.find_by_name(db, user_id, parsed.wallet_name or "Nakit")
        if not wallet:
            raise ValueError("Kasa bulunamadı")
        tx = await wallet_service.add_expense(
            db, user_id, wallet.id, parsed.amount, parsed.category or "Genel",
            parsed.description or "", parsed.place or "",
        )
        return {"transaction_id": str(tx.id), "amount": float(tx.amount)}

    if intent == "add_income":
        wallet = await wallet_service.find_by_name(db, user_id, parsed.wallet_name or "Banka")
        if not wallet:
            raise ValueError("Kasa bulunamadı")
        w = await wallet_service.add_income(db, user_id, wallet.id, parsed.amount, parsed.description or "")
        return {"wallet": wallet.name, "balance": float(w.balance)}

    if intent == "transfer":
        from_w = await wallet_service.find_by_name(db, user_id, parsed.wallet_name or "Banka")
        to_w = await wallet_service.find_by_name(db, user_id, parsed.target_wallet_name or "Nakit")
        if not from_w or not to_w:
            raise ValueError("Kasa bulunamadı")
        await wallet_service.transfer(db, user_id, from_w.id, to_w.id, parsed.amount)
        return {"from": from_w.name, "to": to_w.name, "amount": float(parsed.amount)}

    if intent == "add_shopping":
        items = await shopping_service.add_items(db, user_id, parsed.items or [parsed.description])
        return {"added": [i.name for i in items]}

    if intent == "mark_paid":
        item = await agenda_service.mark_paid(db, user_id, parsed.description or "")
        return {"title": item.title, "status": item.status.value}

    if intent == "add_installment":
        items = await agenda_service.create_installments(
            db, user_id, parsed.description or "Taksit",
            parsed.amount, parsed.installment_count or 6,
        )
        return {"installments": len(items), "per_month": float(items[0].amount)}

    if intent == "add_debt":
        record = await social_service.add_debt(db, user_id, parsed.person_name or "?", parsed.amount)
        return {"person": record.person_name, "amount": float(record.amount)}

    if intent == "split_bill":
        bill = await social_service.split_bill(db, user_id, parsed.amount, 3)
        return {"per_person": float(bill.per_person), "message": bill.share_message}

    raise ValueError(f"Desteklenmeyen intent: {intent}")
