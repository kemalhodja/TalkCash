from decimal import Decimal

from app.services.nlp.turkish_parser import detect_intent, extract_category, parse_turkish_amount
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
    assert extract_category("150 TL kahve starbucks") == "Kahve"
    assert extract_category("market alışverişi") == "Market"


def test_slash_command_local():
    engine = NLPEngine()
    result = engine._parse_locally("/150 kahve banka")
    assert result.intent == "add_expense"
    assert result.amount == Decimal("150")
    assert result.category == "kahve"
