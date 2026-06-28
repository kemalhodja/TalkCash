"""Para birimi algılama ve tutar ayrıştırma."""

import re
from decimal import Decimal

CURRENCY_HINTS: list[tuple[str, str]] = [
    (r"\$", "USD"),
    (r"\b(usd|dolar|dollars?|dolarlık|dolarlik)\b", "USD"),
    (r"€", "EUR"),
    (r"\b(eur|euro|avro)\b", "EUR"),
    (r"£", "GBP"),
    (r"\b(gbp|sterlin|pound|pounds?)\b", "GBP"),
    (r"₺", "TRY"),
    (r"\b(try|tl|lira|türk\s*lirası|turk\s*lirasi)\b", "TRY"),
]


def extract_currency(text: str, default: str = "TRY") -> str:
    lower = text.lower()
    for pattern, code in CURRENCY_HINTS:
        if re.search(pattern, lower):
            return code
    return default


def parse_amount_with_currency(text: str, default_currency: str = "TRY") -> tuple[Decimal | None, str]:
    """Metinden tutar ve para birimini çıkarır."""
    currency = extract_currency(text, default_currency)
    lower = text.lower()

    symbol_match = re.search(
        r"([$€£₺])\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*([$€£])",
        text,
    )
    if symbol_match:
        amount_str = symbol_match.group(2) or symbol_match.group(3)
        sym = symbol_match.group(1) or symbol_match.group(4)
        if sym == "$":
            currency = "USD"
        elif sym == "€":
            currency = "EUR"
        elif sym == "£":
            currency = "GBP"
        elif sym == "₺":
            currency = "TRY"
        return Decimal(amount_str.replace(",", ".")), currency

    num_match = re.search(
        r"(\d+(?:[.,]\d+)?)\s*(usd|dolar|dollars?|eur|euro|avro|gbp|sterlin|tl|lira|try|₺)?",
        lower,
    )
    if num_match:
        amount = Decimal(num_match.group(1).replace(",", "."))
        suffix = num_match.group(2) or ""
        if suffix:
            currency = extract_currency(suffix, currency)
        return amount, currency

    return None, currency
