from app.services.nlp.turkish_parser import detect_easter_egg, detect_intent


def test_detect_easter_egg_triggers():
    assert detect_easter_egg("para bitti ya", "tr") is not None
    assert detect_easter_egg("çok fakirim", "tr") is not None
    assert detect_easter_egg("150 TL kahve", "tr") is None


def test_detect_intent_still_works_after_easter_egg():
    assert detect_intent("listeye süt ekle") == "add_shopping"
