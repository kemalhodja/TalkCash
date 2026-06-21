from app.services.shopping.association import mine_association_rules, normalize_product


def test_normalize_product():
    assert normalize_product("  Et  ") == "et"
    assert normalize_product("SÜT") == "süt"


def test_mine_association_rules_finds_pairs():
    baskets = [
        ["et", "soda"],
        ["et", "soda"],
        ["et", "soda"],
        ["kahve", "süt"],
        ["kahve", "süt"],
        ["et", "ekmek"],
    ]
    rules = mine_association_rules(baskets, min_support=0.1, min_confidence=0.5)
    pairs = {(a, b) for a, b, _ in rules}
    assert ("et", "soda") in pairs


def test_mine_association_rules_respects_threshold():
    baskets = [["et", "soda", "ekmek"], ["kahve", "süt", "şeker"]]
    rules = mine_association_rules(baskets, min_support=0.9, min_confidence=0.9)
    assert rules == []
