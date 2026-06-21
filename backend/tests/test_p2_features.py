from decimal import Decimal

from app.services.nlp.english_parser import extract_date_en, extract_installment_count, parse_english_amount
from app.services.nlp.turkish_parser import extract_installment_count as extract_installment_count_tr
from app.services.ocr.service import OCRService


def test_parse_english_amount_slang():
    assert parse_english_amount("50 bucks") == Decimal("1")
    assert parse_english_amount("2 grand") == Decimal("2000")


def test_extract_date_en():
    assert extract_date_en("pay tomorrow") is not None
    assert extract_date_en("due 15 march") is not None


def test_extract_installment_count_tr():
    assert extract_installment_count_tr("6 taksit kredi kartı") == 6


def test_extract_installment_count_en():
    assert extract_installment_count("12 installments") == 12


def test_ocr_line_items():
    ocr = OCRService()
    text = "MIGROS\nSUT 1L    45,90\nEKMEK     12,50\nTOPLAM   58,40"
    items = ocr._extract_line_items(text)
    assert len(items) >= 2
    assert any("SUT" in i["name"].upper() for i in items)


def test_ocr_extract_product_price():
    ocr = OCRService()
    text = "SUT 1L    45,90\nEKMEK     12,50"
    price = ocr.extract_product_price(text, "süt")
    assert price == Decimal("45.90")


def test_ocr_suggest_category_from_merchant():
    ocr = OCRService()
    assert ocr.suggest_category("MIGROS MARKET", "") == "Market"
    assert ocr.suggest_category("STARBUCKS", "") == "Kahve"
    assert ocr.suggest_category("UNKNOWN SHOP", "") == "Genel"


def test_ocr_extract_due_date():
    ocr = OCRService()
    text = "TURKCELL\nSON ODEME: 25.07.2026\nTOPLAM 450,00 TL"
    due = ocr._extract_due_date(text)
    assert due is not None
    assert due.day == 25
    assert due.month == 7
    assert due.year == 2026
