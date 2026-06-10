import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill


class ExcelExportService:
    def generate_report(
        self,
        user_name: str,
        wallets: list[dict],
        transactions: list[dict],
        agenda_items: list[dict],
    ) -> bytes:
        wb = Workbook()

        ws_summary = wb.active
        ws_summary.title = "Özet"
        ws_summary["A1"] = "TalkCash Finansal Rapor"
        ws_summary["A1"].font = Font(bold=True, size=16)
        ws_summary["A2"] = f"Kullanıcı: {user_name}"
        ws_summary["A3"] = f"Tarih: {datetime.now().strftime('%d.%m.%Y %H:%M')}"

        ws_wallets = wb.create_sheet("Kasalar")
        ws_wallets.append(["Kasa", "Bakiye", "Para Birimi", "Tip"])
        for w in wallets:
            ws_wallets.append([w["name"], w["balance"], w.get("currency", "TRY"), w.get("type", "")])

        ws_tx = wb.create_sheet("İşlemler")
        ws_tx.append(["Tarih", "Kategori", "Tutar", "Açıklama", "Yer"])
        header_fill = PatternFill(start_color="00D4AA", end_color="00D4AA", fill_type="solid")
        for cell in ws_tx[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = header_fill
        for tx in transactions:
            ws_tx.append([
                tx.get("date", ""), tx.get("category", ""),
                tx.get("amount", 0), tx.get("description", ""), tx.get("place", ""),
            ])

        ws_agenda = wb.create_sheet("Ajanda")
        ws_agenda.append(["Başlık", "Tutar", "Son Tarih", "Durum"])
        for a in agenda_items:
            ws_agenda.append([a["title"], a["amount"], a.get("due_date", ""), a.get("status", "")])

        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()
