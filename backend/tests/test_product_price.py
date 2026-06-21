from app.services.product_price.helpers import PRICE_DIFF_THRESHOLD, first_name, normalize_product, normalize_store, price_diff_percent


def test_normalize_product():
    assert normalize_product("  Soda  ") == "soda"


def test_normalize_store():
    assert normalize_store("Migros") == "migros"


def test_price_diff_threshold():
    assert abs(15 - 10) / 10 >= PRICE_DIFF_THRESHOLD
    assert abs(10.4 - 10) / 10 < PRICE_DIFF_THRESHOLD


def test_soda_scenario_percent():
    assert price_diff_percent(15, 10) == 50
