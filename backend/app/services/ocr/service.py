import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from PIL import Image

from app.config import settings
from app.services.ocr.vision import google_vision_text


class OCRService:
    def suggest_category(self, merchant: str, raw_text: str = "") -> str:
        haystack = self._normalize_text(f"{merchant} {raw_text}")
        rules: list[tuple[list[str], str]] = [
            (["migros", "carrefour", "bim", "a101", "sok", "market", "grocery", "supermarket"], "Market"),
            (["starbucks", "kahve", "cafe", "coffee", "nero", "espresso"], "Kahve"),
            (["restoran", "restaurant", "yemek", "burger", "pizza", "kebap"], "Yemek"),
            (["shell", "bp", "petrol", "otopark", "metro", "ulasim", "transport", "taksi"], "Ulaşım"),
            (["elektrik", "enerji", "internet", "fatura", "turkcell", "vodafone", "dogalgaz"], "Faturalar"),
        ]
        for keywords, category in rules:
            if any(kw in haystack for kw in keywords):
                return category
        return "Genel"

    async def extract_receipt_data(self, image_bytes: bytes, locale: str = "tr") -> dict:
        raw_text, engine = await self._extract_text(image_bytes, locale)
        line_items = self._extract_line_items(raw_text)
        merchant = self._extract_merchant(raw_text)
        return {
            "total_amount": self._extract_amount(raw_text),
            "receipt_date": self._extract_date(raw_text),
            "due_date": self._extract_due_date(raw_text),
            "merchant": merchant,
            "ocr_raw_text": raw_text,
            "line_items": line_items,
            "ocr_engine": engine,
            "suggested_category": self.suggest_category(merchant, raw_text),
        }

    async def _extract_text(self, image_bytes: bytes, locale: str) -> tuple[str, str]:
        provider = settings.ocr_provider.lower()
        if provider == "google":
            text = await google_vision_text(image_bytes)
            return text, "google" if text else "none"

        tesseract_text = self._tesseract_ocr(image_bytes, locale)
        if provider == "tesseract":
            return tesseract_text, "tesseract" if tesseract_text else "none"

        # auto: Vision fallback when Tesseract output is too short
        if len(tesseract_text.strip()) >= 10:
            return tesseract_text, "tesseract"
        vision_text = await google_vision_text(image_bytes)
        if vision_text and len(vision_text) > len(tesseract_text):
            return vision_text, "google"
        return tesseract_text or vision_text, "tesseract" if tesseract_text else ("google" if vision_text else "none")

    @staticmethod
    def _tesseract_ocr(image_bytes: bytes, locale: str) -> str:
        lang = "tur+eng"
        try:
            import pytesseract
            image = Image.open(__import__("io").BytesIO(image_bytes))
            return pytesseract.image_to_string(image, lang=lang)
        except Exception:
            return ""

    def verify_transaction(self, receipt_amount: Decimal | None, transaction_amount: Decimal, tolerance: Decimal = Decimal("1")) -> bool:
        if receipt_amount is None:
            return False
        return abs(receipt_amount - transaction_amount) <= tolerance

    @staticmethod
    def _normalize_text(value: str) -> str:
        table = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
        return value.translate(table).lower()

    def extract_product_price(self, text: str, product: str) -> Decimal | None:
        if not text or not product:
            return None
        product_norm = self._normalize_text(product)
        for line in text.split("\n"):
            line_norm = self._normalize_text(line)
            if product_norm not in line_norm:
                continue
            amounts = re.findall(r"(\d+[.,]\d{2})", line)
            if amounts:
                try:
                    return Decimal(amounts[-1].replace(",", "."))
                except InvalidOperation:
                    continue
        pattern = rf"{re.escape(product_norm)}.{{0,40}}?(\d+[.,]\d{{2}})"
        match = re.search(pattern, self._normalize_text(text))
        if match:
            try:
                return Decimal(match.group(1).replace(",", "."))
            except InvalidOperation:
                pass
        return None

    def _extract_line_items(self, text: str) -> list[dict]:
        items = []
        for line in text.split("\n"):
            line = line.strip()
            if len(line) < 3:
                continue
            amounts = re.findall(r"(\d+[.,]\d{2})", line)
            if not amounts:
                continue
            name = re.sub(r"\d+[.,]\d{2}.*", "", line).strip(" -*\t")
            if len(name) < 2:
                continue
            try:
                price = Decimal(amounts[-1].replace(",", "."))
                items.append({"name": name[:80], "price": float(price)})
            except InvalidOperation:
                continue
        return items[:30]

    def _extract_amount(self, text: str) -> Decimal | None:
        patterns = [
            r"(?:toplam|total|tutar|amount)\s*:?\s*(\d+[.,]\d{2})",
            r"(\d+[.,]\d{2})\s*(?:tl|₺|try|usd)?",
        ]
        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    return Decimal(match.group(1).replace(",", "."))
                except InvalidOperation:
                    continue
        return None

    def _extract_date(self, text: str) -> datetime | None:
        match = re.search(r"(\d{2})[./](\d{2})[./](\d{4})", text)
        if match:
            try:
                return datetime(int(match.group(3)), int(match.group(2)), int(match.group(1)))
            except ValueError:
                pass
        return None

    def _extract_due_date(self, text: str) -> datetime | None:
        if not text:
            return None
        haystack = self._normalize_text(text)
        patterns = [
            r"(?:son\s*odeme|odeme\s*tarihi|due\s*date|payment\s*due|vade\s*tarihi)\s*:?\s*(\d{2})[./](\d{2})[./](\d{4})",
            r"(?:son\s*odeme|odeme\s*tarihi|due\s*date|payment\s*due|vade\s*tarihi)\s*:?\s*(\d{2})[./](\d{2})[./](\d{2})",
        ]
        for pattern in patterns:
            match = re.search(pattern, haystack)
            if not match:
                continue
            day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            if year < 100:
                year += 2000
            try:
                return datetime(year, month, day)
            except ValueError:
                continue
        return None

    def _extract_merchant(self, text: str) -> str:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        return lines[0][:100] if lines else ""
