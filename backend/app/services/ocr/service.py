import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from PIL import Image


class OCRService:
    async def extract_receipt_data(self, image_bytes: bytes) -> dict:
        try:
            import pytesseract
            image = Image.open(__import__("io").BytesIO(image_bytes))
            raw_text = pytesseract.image_to_string(image, lang="tur")
        except Exception:
            raw_text = ""

        return {
            "total_amount": self._extract_amount(raw_text),
            "receipt_date": self._extract_date(raw_text),
            "merchant": self._extract_merchant(raw_text),
            "ocr_raw_text": raw_text,
        }

    def verify_transaction(self, receipt_amount: Decimal | None, transaction_amount: Decimal, tolerance: Decimal = Decimal("1")) -> bool:
        if receipt_amount is None:
            return False
        return abs(receipt_amount - transaction_amount) <= tolerance

    def _extract_amount(self, text: str) -> Decimal | None:
        patterns = [
            r"(?:toplam|total|tutar)\s*:?\s*(\d+[.,]\d{2})",
            r"(\d+[.,]\d{2})\s*(?:tl|₺|try)",
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

    def _extract_merchant(self, text: str) -> str:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        return lines[0][:100] if lines else ""
