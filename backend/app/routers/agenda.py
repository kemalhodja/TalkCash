from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error
from app.models.user import User
from app.services.agenda.service import AgendaService

router = APIRouter(prefix="/agenda", tags=["Agenda"])
agenda_service = AgendaService()


def _serialize_item(i) -> dict:
    return {
        "id": str(i.id), "title": i.title, "amount": float(i.amount),
        "due_date": i.due_date.isoformat(), "status": i.status.value,
        "paid_at": i.paid_at.isoformat() if i.paid_at else None,
        "installment": f"{i.installment_current}/{i.installment_total}" if i.installment_total else None,
        "is_recurring": i.is_recurring,
    }


class AgendaUpdate(BaseModel):
    title: str | None = None
    amount: float | None = None
    due_date: datetime | None = None
    is_recurring: bool | None = None


@router.get("/")
async def list_agenda(days: int = 30, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await agenda_service.list_upcoming(db, user.id, days)
    return [_serialize_item(i) for i in items]


@router.get("/history")
async def list_paid_history(limit: int = 50, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await agenda_service.list_paid(db, user.id, limit)
    return [_serialize_item(i) for i in items]


@router.patch("/{item_id}")
async def update_agenda_item(
    item_id: UUID, data: AgendaUpdate,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        item = await agenda_service.update_item(
            db, user.id, item_id,
            title=data.title,
            amount=Decimal(str(data.amount)) if data.amount is not None else None,
            due_date=data.due_date,
            is_recurring=data.is_recurring,
        )
        return _serialize_item(item)
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))


@router.delete("/{item_id}")
async def delete_agenda_item(
    item_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        await agenda_service.delete_item(db, user.id, item_id)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))


@router.post("/bill")
async def add_bill(
    title: str, amount: float, due_date: datetime,
    is_recurring: bool = False, force: bool = False,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        item = await agenda_service.add_bill(db, user.id, title, Decimal(str(amount)), due_date, is_recurring, force=force)
        return {"id": str(item.id), "title": item.title}
    except Exception as e:
        raise HTTPException(status_code=409, detail=resolve_error(e, user_locale(user)))


@router.post("/installments")
async def create_installments(
    title: str, total: float, count: int,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    items = await agenda_service.create_installments(db, user.id, title, Decimal(str(total)), count)
    return {"count": len(items), "per_installment": float(items[0].amount)}


@router.post("/pay")
async def mark_paid(
    title: str, wallet_id: UUID | None = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        item = await agenda_service.mark_paid(db, user.id, title, wallet_id)
        return {"id": str(item.id), "status": item.status.value}
    except Exception as e:
        raise HTTPException(status_code=404, detail=resolve_error(e, user_locale(user)))
