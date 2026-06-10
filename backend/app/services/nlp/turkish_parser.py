import re
from datetime import datetime, timedelta
from decimal import Decimal

TURKISH_NUMBER_MAP = {
    "bir": 1, "iki": 2, "üç": 3, "uc": 3, "dört": 4, "dort": 4,
    "beş": 5, "bes": 5, "altı": 6, "alti": 6, "yedi": 7, "sekiz": 8,
    "dokuz": 9, "on": 10, "yirmi": 20, "otuz": 30, "kırk": 40, "kirk": 40,
    "elli": 50, "altmış": 60, "altmis": 60, "yetmiş": 70, "yetmis": 70,
    "seksen": 80, "doksan": 90, "yüz": 100, "yuz": 100, "bin": 1000,
}

SLANG_AMOUNT_MAP = {
    "kağıt": 200, "kagit": 200, "yüzlük": 100, "yuzluk": 100,
    "ikiyüzlük": 200, "ikiyuzluk": 200, "beşlik": 5, "beslik": 5,
    "onluk": 10, "yirmilik": 20, "ellilik": 50, "gömdük": 100, "gomduk": 100,
}

MONTH_MAP = {
    "ocak": 1, "şubat": 2, "subat": 2, "mart": 3, "nisan": 4, "mayıs": 5, "mayis": 5,
    "haziran": 6, "temmuz": 7, "ağustos": 8, "agustos": 8, "eylül": 9, "eylul": 9,
    "ekim": 10, "kasım": 11, "kasim": 11, "aralık": 12, "aralik": 12,
}


def parse_turkish_amount(text: str) -> Decimal | None:
    text_lower = text.lower()

    for slang, value in SLANG_AMOUNT_MAP.items():
        if slang in text_lower:
            return Decimal(str(value))

    word_match = re.search(
        r"(bir|iki|üç|uc|dört|dort|beş|bes|altı|alti|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|kirk|elli|altmış|altmis|yetmiş|yetmis|seksen|doksan|yüz|yuz|bin)\s*(lira|tl|₺)?",
        text_lower,
    )
    if word_match:
        return Decimal(str(TURKISH_NUMBER_MAP.get(word_match.group(1), 0)))

    num_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(tl|lira|₺)?", text_lower)
    if num_match:
        return Decimal(num_match.group(1).replace(",", "."))

    return None


def extract_date(text: str) -> datetime | None:
    text_lower = text.lower()
    now = datetime.utcnow()

    if "yarın" in text_lower or "yarin" in text_lower:
        return now + timedelta(days=1)
    if "gelecek hafta" in text_lower:
        return now + timedelta(days=7)
    if "ay sonu" in text_lower:
        next_month = now.replace(day=28) + timedelta(days=4)
        last_day = next_month - timedelta(days=next_month.day)
        return last_day.replace(hour=12, minute=0, second=0, microsecond=0)

    day_month = re.search(r"(\d{1,2})\s*(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)", text_lower)
    if day_month:
        day = int(day_month.group(1))
        month = MONTH_MAP.get(day_month.group(2), now.month)
        year = now.year
        if month < now.month:
            year += 1
        return datetime(year, month, min(day, 28), 12, 0, 0)

    in_days = re.search(r"(\d+)\s*gün\s*sonra", text_lower)
    if in_days:
        return now + timedelta(days=int(in_days.group(1)))

    return None


def detect_intent(text: str) -> str:
    text_lower = text.lower()
    if any(w in text_lower for w in ["listeye", "liste", "alınacak", "alınacaklar"]):
        return "add_shopping"
    if any(w in text_lower for w in ["ödedim", "odedim", "ödendi", "odendi"]):
        return "mark_paid"
    if any(w in text_lower for w in ["maaş", "maas", "gelir", "yattı", "yatti"]):
        return "add_income"
    if any(w in text_lower for w in ["transfer", "çektim", "cektim", "aktar"]):
        return "transfer"
    if any(w in text_lower for w in ["borç", "borc", "verdim", "ödünç", "odunc"]):
        return "add_debt"
    if any(w in text_lower for w in ["böl", "bol", "hesabı", "hesabi", "kişi"]):
        return "split_bill"
    if any(w in text_lower for w in ["taksit"]):
        return "add_installment"
    if any(w in text_lower for w in ["fatura", "kira", "elektrik", "internet"]):
        return "add_bill"
    return "add_expense"


def extract_category(text: str) -> str:
    categories = {
        "kahve": "Kahve", "market": "Market", "mutfak": "Mutfak",
        "restoran": "Restoran", "yemek": "Yemek", "benzin": "Ulaşım",
        "taksi": "Ulaşım", "uber": "Ulaşım", "kira": "Kira",
        "elektrik": "Fatura", "internet": "Fatura", "su": "Fatura",
        "giyim": "Giyim", "sağlık": "Sağlık", "saglik": "Sağlık",
    }
    text_lower = text.lower()
    for keyword, category in categories.items():
        if keyword in text_lower:
            return category
    return "Genel"


def extract_wallet_name(text: str) -> str | None:
    wallets = {
        "nakit": "Nakit", "banka": "Banka", "kredi kartı": "Kredi Kartı",
        "kredi karti": "Kredi Kartı", "altın": "Altın", "altin": "Altın",
        "döviz": "Döviz", "doviz": "Döviz",
    }
    text_lower = text.lower()
    for keyword, name in wallets.items():
        if keyword in text_lower:
            return name
    return None


def extract_shopping_items(text: str) -> list[str]:
    match = re.search(r"(?:listeye|ekle)\s+(.+)", text.lower())
    if not match:
        return []
    raw = match.group(1)
    items = re.split(r"[,;]\s*|\s+ve\s+", raw)
    return [item.strip() for item in items if item.strip()]
