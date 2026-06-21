from app.utils.json_safe import safe_parse_json


def test_safe_parse_json_valid():
    assert safe_parse_json('{"intent":"add_expense","amount":50}')["intent"] == "add_expense"


def test_safe_parse_json_markdown_fence():
    raw = '```json\n{"intent":"add_shopping","items":["süt"]}\n```'
    data = safe_parse_json(raw)
    assert data.get("intent") == "add_shopping"


def test_safe_parse_json_invalid():
    assert safe_parse_json("not json") == {}
    assert safe_parse_json(None) == {}
