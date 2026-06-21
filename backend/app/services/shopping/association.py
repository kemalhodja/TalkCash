"""Lightweight association-rule mining (Apriori-style pair counting)."""

from collections import Counter


def normalize_product(name: str) -> str:
    return name.lower().strip()


def mine_association_rules(
    baskets: list[list[str]],
    *,
    min_support: float = 0.05,
    min_confidence: float = 0.35,
) -> list[tuple[str, str, float]]:
    """
    Returns directed rules (product_a, suggested_product_b, confidence).
    confidence = P(B|A) = count(A and B in same basket) / count(A in basket)
    """
    normalized: list[list[str]] = []
    for basket in baskets:
        items = list({normalize_product(i) for i in basket if i and i.strip()})
        if len(items) >= 2:
            normalized.append(items)

    if not normalized:
        return []

    total = len(normalized)
    item_counts: Counter[str] = Counter()
    pair_counts: Counter[tuple[str, str]] = Counter()

    for basket in normalized:
        for item in basket:
            item_counts[item] += 1
        for a in basket:
            for b in basket:
                if a != b:
                    pair_counts[(a, b)] += 1

    rules: list[tuple[str, str, float]] = []
    for (a, b), pair_count in pair_counts.items():
        support = pair_count / total
        confidence = pair_count / item_counts[a]
        if support >= min_support and confidence >= min_confidence:
            rules.append((a, b, round(confidence, 4)))

    rules.sort(key=lambda r: r[2], reverse=True)
    return rules
