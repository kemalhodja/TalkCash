import io
from datetime import datetime
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class PDFExportService:
    def generate_report(
        self,
        user_name: str,
        net_worth: Decimal,
        wallets: list[dict],
        transactions: list[dict],
        agenda_items: list[dict],
    ) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        elements = []

        elements.append(Paragraph(f"TalkCash Finansal Rapor — {user_name}", styles["Title"]))
        elements.append(Paragraph(f"Tarih: {datetime.now().strftime('%d.%m.%Y %H:%M')}", styles["Normal"]))
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(f"Net Varlık: {net_worth:,.2f} TL", styles["Heading2"]))
        elements.append(Spacer(1, 12))

        if wallets:
            elements.append(Paragraph("Kasalar", styles["Heading3"]))
            wallet_data = [["Kasa", "Bakiye", "Para Birimi"]]
            for w in wallets:
                wallet_data.append([w["name"], f"{w['balance']:,.2f}", w.get("currency", "TRY")])
            t = Table(wallet_data)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#00D4AA")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 16))

        if transactions:
            elements.append(Paragraph("Son İşlemler", styles["Heading3"]))
            tx_data = [["Tarih", "Kategori", "Tutar", "Açıklama"]]
            for tx in transactions[:50]:
                tx_data.append([
                    tx.get("date", ""), tx.get("category", ""),
                    f"{tx.get('amount', 0):,.2f}", tx.get("description", ""),
                ])
            t = Table(tx_data)
            t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)]))
            elements.append(t)
            elements.append(Spacer(1, 16))

        if agenda_items:
            elements.append(Paragraph("Yaklaşan Ödemeler", styles["Heading3"]))
            ag_data = [["Başlık", "Tutar", "Son Tarih", "Durum"]]
            for a in agenda_items:
                ag_data.append([a["title"], f"{a['amount']:,.2f}", a.get("due_date", ""), a.get("status", "")])
            t = Table(ag_data)
            t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)]))
            elements.append(t)

        doc.build(elements)
        return buffer.getvalue()
