from decimal import Decimal

import pytest

from app.services.micro_savings.service import MicroSavingsService, SWAP_RULE_KEYS


@pytest.fixture
def service():
    return MicroSavingsService()


def test_evaluate_coffee_savings(service):
    result = service.evaluate("Starbucks latte", "Yeme-İçme", Decimal("55"), "tr")
    assert result is not None
    assert result["rule_key"] == "coffee"
    assert result["saved_amount"] == 47.0
    assert "Altın" in result["speech_text"]


def test_evaluate_delivery_ratio(service):
    result = service.evaluate("Yemeksepeti sipariş", "Yeme-İçme", Decimal("200"), "en")
    assert result is not None
    assert result["rule_key"] == "delivery"
    assert result["saved_amount"] == 130.0
    assert result["target_label"] == "Forex"


def test_evaluate_delivery_global_en(service):
    result = service.evaluate("DoorDash dinner", "Food", Decimal("80"), "en")
    assert result is not None
    assert result["rule_key"] == "delivery"
    assert result["saved_amount"] == 52.0


def test_evaluate_coffee_global_en(service):
    result = service.evaluate("Dunkin latte", "Coffee", Decimal("45"), "en")
    assert result is not None
    assert result["rule_key"] == "coffee"
    assert result["saved_amount"] == 37.0


def test_evaluate_rideshare_en(service):
    result = service.evaluate("Lyft ride downtown", "Transport", Decimal("100"), "en")
    assert result is not None
    assert result["rule_key"] == "taxi"
    assert result["saved_amount"] == 75.0


def test_evaluate_below_threshold(service):
    result = service.evaluate("kahve", "Genel", Decimal("10"), "tr")
    assert result is None


def test_evaluate_no_match(service):
    result = service.evaluate("kira", "Konut", Decimal("5000"), "tr")
    assert result is None


def test_evaluate_taxi(service):
    result = service.evaluate("Uber taksi", "Ulaşım", Decimal("120"), "tr")
    assert result is not None
    assert result["rule_key"] == "taxi"
    assert result["saved_amount"] == 90.0


def test_monthly_projection():
    service = MicroSavingsService()
    rows = service._build_monthly_projection(100.0, 500.0)
    assert len(rows) == 12
    assert rows[0]["cumulative"] == 600.0
    assert rows[11]["cumulative"] == 1700.0


def test_compute_round_up(service):
    result = service.compute_round_up(Decimal("47"), 10)
    assert result is not None
    rounded, spare = result
    assert float(rounded) == 50.0
    assert float(spare) == 3.0


def test_compute_round_up_exact_multiple(service):
    assert service.compute_round_up(Decimal("50"), 10) is None


def test_swap_rule_keys_cover_rules():
    assert "coffee" in SWAP_RULE_KEYS
    assert "round_up" not in SWAP_RULE_KEYS
