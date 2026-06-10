from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import t
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
async def export_pdf(
    limit: int = 500,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    locale = user_locale(user)
    data = await _gather_data(db, user, limit=limit)
    content = pdf_service.generate_report(
        user.full_name or user.email, data["net_worth"],
        data["wallets"], data["transactions"], data["agenda"],
        data["category_totals"], locale,
    )
    filename = t("export.filename", locale)
    return Response(content, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename={filename}.pdf"
    })


@router.get("/excel")
async def export_excel(
    limit: int = 500,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    locale = user_locale(user)
    data = await _gather_data(db, user, limit=limit)
    content = excel_service.generate_report(
        user.full_name or user.email,
        data["wallets"], data["transactions"], data["agenda"], locale,
    )
    filename = t("export.filename", locale)
    return Response(content, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={
        "Content-Disposition": f"attachment; filename={filename}.xlsx"
    })


async def _gather_data(db: AsyncSession, user: User, limit: int = 500) -> dict:
    nw = await wallet_service.get_net_worth(db, user.id)
    wallets = [{"name": w.name, "balance": float(w.balance), "currency": w.currency, "type": w.wallet_type.value} for w in nw.wallets]

    tx_result = await db.execute(
        select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.created_at.desc()).limit(min(limit, 2000))
    )
    tx_rows = list(tx_result.scalars().all())
    transactions = [
        {"date": tx.created_at.strftime("%d.%m.%Y"), "category": tx.category,
         "amount": float(tx.amount), "description": tx.description, "place": tx.place}
        for tx in tx_rows
    ]
    now = datetime.utcnow()
    category_totals: dict[str, float] = defaultdict(float)
    for tx in tx_rows:
        if tx.created_at.month == now.month and tx.created_at.year == now.year:
            if tx.transaction_type.value == "expense":
                category_totals[tx.category or "Genel"] += float(tx.amount)

    ag_result = await db.execute(select(AgendaItem).where(AgendaItem.user_id == user.id))
    agenda = [
        {"title": a.title, "amount": float(a.amount),
         "due_date": a.due_date.strftime("%d.%m.%Y"), "status": a.status.value}
        for a in ag_result.scalars().all()
    ]

    return {
        "net_worth": nw.total_try, "wallets": wallets, "transactions": transactions,
        "agenda": agenda, "category_totals": dict(category_totals),
    }
