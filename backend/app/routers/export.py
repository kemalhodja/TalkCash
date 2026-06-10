from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.agenda import AgendaItem
from app.models.transaction import Transaction
from app.models.user import User
from app.models.wallet import Wallet
from app.services.export.excel_service import ExcelExportService
from app.services.export.pdf_service import PDFExportService
from app.services.wallet.service import WalletService

router = APIRouter(prefix="/export", tags=["Export"])
pdf_service = PDFExportService()
excel_service = ExcelExportService()
wallet_service = WalletService()


@router.get("/pdf")
async def export_pdf(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = await _gather_data(db, user)
    content = pdf_service.generate_report(
        user.full_name or user.email, data["net_worth"],
        data["wallets"], data["transactions"], data["agenda"],
    )
    return Response(content, media_type="application/pdf", headers={
        "Content-Disposition": "attachment; filename=talkcash-rapor.pdf"
    })


@router.get("/excel")
async def export_excel(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = await _gather_data(db, user)
    content = excel_service.generate_report(
        user.full_name or user.email,
        data["wallets"], data["transactions"], data["agenda"],
    )
    return Response(content, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={
        "Content-Disposition": "attachment; filename=talkcash-rapor.xlsx"
    })


async def _gather_data(db: AsyncSession, user: User) -> dict:
    nw = await wallet_service.get_net_worth(db, user.id)
    wallets = [{"name": w.name, "balance": float(w.balance), "currency": w.currency, "type": w.wallet_type.value} for w in nw.wallets]

    tx_result = await db.execute(
        select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.created_at.desc()).limit(100)
    )
    transactions = [
        {"date": t.created_at.strftime("%d.%m.%Y"), "category": t.category,
         "amount": float(t.amount), "description": t.description, "place": t.place}
        for t in tx_result.scalars().all()
    ]

    ag_result = await db.execute(select(AgendaItem).where(AgendaItem.user_id == user.id))
    agenda = [
        {"title": a.title, "amount": float(a.amount),
         "due_date": a.due_date.strftime("%d.%m.%Y"), "status": a.status.value}
        for a in ag_result.scalars().all()
    ]

    return {"net_worth": nw.total_try, "wallets": wallets, "transactions": transactions, "agenda": agenda}
