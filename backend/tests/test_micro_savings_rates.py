"""Tests for live rates and investment simulation."""

from app.services.micro_savings.rates import simulate_growth, try_to_gold_grams
from app.services.micro_savings.brokers import build_broker_open_url, list_brokers
from decimal import Decimal


def test_simulate_growth_returns_timeline():
    result = simulate_growth(100.0, 12, 500.0, 0.08)
    assert result["months"] == 12
    assert len(result["timeline"]) == 12
    assert result["final_balance"] > 500.0 + 100.0 * 12


def test_try_to_gold_grams():
    assert try_to_gold_grams(Decimal("2850"), 2850.0) == 1.0


def test_broker_open_url_with_amount():
    broker = {"web_url": "https://www.getmidas.com/"}
    url = build_broker_open_url(broker, amount_try=150.0, locale="tr")
    assert "utm_source=talkcash" in url
    assert "ref_amount=150" in url


def test_list_brokers_en_includes_global():
    ids = {b["id"] for b in list_brokers("en")}
    assert "revolut" in ids
    assert "trading212" in ids


def test_list_brokers_tr_includes_local():
    ids = {b["id"] for b in list_brokers("tr")}
    assert "midas" in ids
    assert "papara" in ids
