from decimal import Decimal

from app.services.nlp.turkish_parser import (
    detect_intent,
    extract_category,
    extract_date,
    extract_paid_bill_title,
    parse_turkish_amount,
    refine_expense_category,
)
from app.services.nlp.engine import NLPEngine


def test_parse_turkish_slang():
    assert parse_turkish_amount("200 kağıt market") == Decimal("200")
    assert parse_turkish_amount("elli lira bıraktım") == Decimal("50")
    assert parse_turkish_amount("yüzlük gömdük") == Decimal("100")


def test_detect_intent():
    assert detect_intent("listeye süt ekle") == "add_shopping"
    assert detect_intent("elektrik faturasını ödedim") == "mark_paid"
    assert detect_intent("maaşım yattı") == "add_income"


def test_extract_category():
    assert extract_category("150 TL kahve starbucks") == "Yemek · Dışarıda Yemek"
    assert "Market Alışverişi" in extract_category("market alışverişi")


def test_extract_date_past():
    result = extract_date("dün akşam marketten 450 TL'ye et aldım")
    assert result is not None
    from datetime import datetime, timedelta
    expected = (datetime.utcnow() - timedelta(days=1)).date()
    assert result.date() == expected


def test_refine_expense_subcategory():
    assert "Dışarıda Yemek" in refine_expense_category("yemeksepeti sipariş", "Yemek")
def test_extract_date_future():
    result = extract_date("elektrik faturası yarın")
    assert result is not None
    result2 = extract_date("kira 15 ocak")
    assert result2 is not None
    assert result2.month in (1, 12)


def test_slash_command_local():
    engine = NLPEngine()
    result = engine._parse_locally("/150 kahve banka")
    assert result.intent == "add_expense"
    assert result.amount == Decimal("150")
    assert result.category == "kahve"


def test_local_parse_expense_without_openai():
    engine = NLPEngine()
    result = engine._parse_locally("50 TL kahve")
    assert result.intent == "add_expense"
    assert result.amount == Decimal("50")
