from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.agenda.service import AgendaService

router = APIRouter(prefix="/agenda", tags=["Agenda"])
agenda_service = AgendaService()


@router.get("/")
async def list_agenda(user_id: UUID, days: int = 30, db: AsyncSession = Depends(get_db)):
    items = await agenda_service.list_upcoming(db, user_id, days)
    return [
        {
            "id": str(i.id), "title": i.title, "amount": float(i.amount),
            "due_date": i.due_date.isoformat(), "status": i.status.value,
            "installment": f"{i.installment_current}/{i.installment_total}" if i.installment_total else None,
        }
        for i in items
    ]


@router.post("/bill")
async def add_bill(
    user_id: UUID, title: str, amount: float, due_date: datetime,
    is_recurring: bool = False, force: bool = False, db: AsyncSession = Depends(get_db),
):
    try:
        item = await agenda_service.add_bill(db, user_id, title, Decimal(str(amount)), due_date, is_recurring, force=force)
        return {"id": str(item.id), "title": item.title}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/installments")
async def create_installments(
    user_id: UUID, title: str, total: float, count: int,
    db: AsyncSession = Depends(get_db),
):
    items = await agenda_service.create_installments(db, user_id, title, Decimal(str(total)), count)
    return {"count": len(items), "per_installment": float(items[0].amount)}


@router.post("/pay")
async def mark_paid(user_id: UUID, title: str, wallet_id: UUID | None = None, db: AsyncSession = Depends(get_db)):
    try:
        item = await agenda_service.mark_paid(db, user_id, title, wallet_id)
        return {"id": str(item.id), "status": item.status.value}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
