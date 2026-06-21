from app.services.nlp.turkish_parser import extract_store_name


def test_extract_store_name_known_brands():
    assert extract_store_name("Bim'den 15 TL soda") == "Bim"
    assert extract_store_name("carrefour market alışverişi") == "Carrefour"


def test_extract_store_name_from_suffix():
    assert extract_store_name("Migros'tan süt aldım") == "Migros"
    assert extract_store_name("Carrefour'dan 15 liraya soda aldım") == "Carrefour"


def test_extract_store_name_carrefour_soda_phrase():
    assert extract_store_name("carrefour'dan 15 liraya soda aldım") == "Carrefour"


def test_extract_store_name_unknown():
    assert extract_store_name("150 TL kahve") is None
