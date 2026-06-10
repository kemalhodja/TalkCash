from decimal import Decimal

from app.services.export.pdf_service import PDFExportService
from app.services.export.excel_service import ExcelExportService


def test_pdf_export_en():
    service = PDFExportService()
    content = service.generate_report(
        "Test User", Decimal("1000"),
        [{"name": "Cash", "balance": 1000, "currency": "TRY"}],
        [{"date": "01.01.2025", "category": "Food", "amount": 50, "description": "Lunch"}],
        [{"title": "Rent", "amount": 500, "due_date": "15.01.2025", "status": "pending"}],
        locale="en",
    )
    assert content[:4] == b"%PDF"


def test_excel_export_tr():
    service = ExcelExportService()
    content = service.generate_report(
        "Test Kullanıcı",
        [{"name": "Nakit", "balance": 500, "currency": "TRY", "type": "cash"}],
        [],
        [],
        locale="tr",
    )
    assert content[:2] == b"PK"
