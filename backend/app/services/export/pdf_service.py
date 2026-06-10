import io
from datetime import datetime
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.i18n import t


class PDFExportService:
    def generate_report(
        self,
        user_name: str,
        net_worth: Decimal,
        wallets: list[dict],
        transactions: list[dict],
        agenda_items: list[dict],
        locale: str = "tr",
    ) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        elements = []
        now = datetime.now().strftime("%d.%m.%Y %H:%M")

        elements.append(Paragraph(t("export.title", locale, name=user_name), styles["Title"]))
        elements.append(Paragraph(t("export.date", locale, date=now), styles["Normal"]))
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(t("export.net_worth", locale, amount=f"{net_worth:,.2f}"), styles["Heading2"]))
        elements.append(Spacer(1, 12))

        if wallets:
            elements.append(Paragraph(t("export.wallets", locale), styles["Heading3"]))
            wallet_data = [[
                t("export.col.wallet", locale),
                t("export.col.balance", locale),
                t("export.col.currency", locale),
            ]]
            for w in wallets:
                wallet_data.append([w["name"], f"{w['balance']:,.2f}", w.get("currency", "TRY")])
            table = Table(wallet_data)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#00D4AA")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(table)
            elements.append(Spacer(1, 16))

        if transactions:
            elements.append(Paragraph(t("export.transactions", locale), styles["Heading3"]))
            tx_data = [[
                t("export.col.date", locale),
                t("export.col.category", locale),
                t("export.col.amount", locale),
                t("export.col.description", locale),
            ]]
            for tx in transactions[:50]:
                tx_data.append([
                    tx.get("date", ""), tx.get("category", ""),
                    f"{tx.get('amount', 0):,.2f}", tx.get("description", ""),
                ])
            table = Table(tx_data)
            table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)]))
            elements.append(table)
            elements.append(Spacer(1, 16))

        if agenda_items:
            elements.append(Paragraph(t("export.agenda", locale), styles["Heading3"]))
            ag_data = [[
                t("export.col.title", locale),
                t("export.col.amount", locale),
                t("export.col.due_date", locale),
                t("export.col.status", locale),
            ]]
            for a in agenda_items:
                ag_data.append([a["title"], f"{a['amount']:,.2f}", a.get("due_date", ""), a.get("status", "")])
            table = Table(ag_data)
            table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)]))
            elements.append(table)

        doc.build(elements)
        return buffer.getvalue()
