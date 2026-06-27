import re
from datetime import datetime, timedelta
from decimal import Decimal

EN_SLANG_AMOUNT = {
    "buck": 1, "bucks": 1, "grand": 1000, "k": 1000,
    "quid": 1, "fiver": 5, "tenner": 10, "hundred": 100,
}

MONTH_MAP_EN = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_english_amount(text: str) -> Decimal | None:
    lower = text.lower()
    grand = re.search(r"(\d+(?:\.\d+)?)\s*(k|grand)\b", lower)
    if grand:
        return Decimal(grand.group(1)) * 1000
    for slang, value in EN_SLANG_AMOUNT.items():
        if re.search(rf"\b{slang}\b", lower):
            return Decimal(str(value))
    num = re.search(r"(\d+(?:\.\d+)?)\s*(?:usd|dollars?|try|tl|₺)?", lower)
    if num:
        return Decimal(num.group(1))
    return None


def extract_date_en(text: str) -> datetime | None:
    lower = text.lower()
    now = datetime.utcnow()
    if re.search(r"\btoday\b", lower):
        return now.replace(hour=12, minute=0, second=0, microsecond=0)
    if re.search(r"\byesterday\b", lower):
        return (now - timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0)
    if "last week" in lower:
        return (now - timedelta(days=7)).replace(hour=12, minute=0, second=0, microsecond=0)
    if "tomorrow" in lower:
        return now + timedelta(days=1)
    if "next week" in lower:
        return now + timedelta(days=7)
    if "end of month" in lower:
        next_month = now.replace(day=28) + timedelta(days=4)
        return (next_month - timedelta(days=next_month.day)).replace(hour=12, minute=0, second=0)

    in_days = re.search(r"in\s+(\d+)\s+days?", lower)
    if in_days:
        return now + timedelta(days=int(in_days.group(1)))

    day_month = re.search(
        r"(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)",
        lower,
    )
    if day_month:
        day = int(day_month.group(1))
        month = MONTH_MAP_EN.get(day_month.group(2), now.month)
        year = now.year
        if month < now.month:
            year += 1
        return datetime(year, month, min(day, 28), 12, 0, 0)
    return None


def extract_target_wallet_en(text: str) -> str | None:
    lower = text.lower()
    if "to cash" in lower or "into cash" in lower:
        return "Cash"
    if "to bank" in lower or "into bank" in lower:
        return "Bank"
    return None


def extract_installment_count(text: str) -> int | None:
    lower = text.lower()
    m = re.search(r"(\d+)\s*(?:installments?|taksit)", lower)
    return int(m.group(1)) if m else None
