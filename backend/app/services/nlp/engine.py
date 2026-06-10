import json
import re
from datetime import datetime
from decimal import Decimal

from openai import AsyncOpenAI

from app.config import settings
from app.i18n import I18nError, t
from app.schemas.common import ParsedInput
from app.services.nlp.turkish_parser import (
    detect_intent,
    extract_category,
    extract_date,
    extract_shopping_items,
    extract_wallet_name,
    parse_turkish_amount,
)

SYSTEM_PROMPT_TR = """Sen TalkCash finans uygulamasının NLP motorusun.
Kullanıcının Türkçe doğal dil girdisini analiz edip JSON döndür.

Desteklenen intent'ler:
- add_expense, add_income, transfer, add_bill, add_installment
- add_shopping, mark_paid, add_debt, split_bill

Yerel ifadeleri sayıya çevir: "200 kağıt"=200, "elli lira"=50, "yüzlük gömdük"=100

JSON formatı:
{
  "intent": "string",
  "amount": number|null,
  "currency": "TRY",
  "category": "string|null",
  "description": "string|null",
  "place": "string|null",
  "wallet_name": "string|null",
  "target_wallet_name": "string|null",
  "items": ["string"],
  "person_name": "string|null",
  "installment_count": number|null,
  "date": "ISO-8601 datetime string|null",
  "confidence": 0.0-1.0
}"""

SYSTEM_PROMPT_EN = """You are the NLP engine for TalkCash personal finance app.
Analyze the user's natural language input and return JSON.

Supported intents:
- add_expense, add_income, transfer, add_bill, add_installment
- add_shopping, mark_paid, add_debt, split_bill

JSON format:
{
  "intent": "string",
  "amount": number|null,
  "currency": "TRY",
  "category": "string|null",
  "description": "string|null",
  "place": "string|null",
  "wallet_name": "string|null",
  "target_wallet_name": "string|null",
  "items": ["string"],
  "person_name": "string|null",
  "installment_count": number|null,
  "date": "ISO-8601 datetime string|null",
  "confidence": 0.0-1.0
}"""


class NLPEngine:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    async def parse_text(self, text: str, whisper_mode: bool = False, locale: str = "tr") -> ParsedInput:
        if self.client:
            try:
                return await self._parse_with_llm(text, locale, whisper_mode=whisper_mode)
            except Exception:
                pass
        if locale == "en":
            return self._parse_locally_en(text)
        return self._parse_locally(text, whisper_mode=whisper_mode)

    async def transcribe_audio(self, audio_bytes: bytes, whisper_mode: bool = False, locale: str = "tr") -> str:
        if not self.client:
            raise I18nError("nlp.openai_required")
        lang = "en" if locale == "en" else "tr"
        kwargs: dict = {
            "model": settings.whisper_model,
            "file": ("audio.webm", audio_bytes),
            "language": lang,
        }
        if whisper_mode:
            kwargs["prompt"] = "quiet whisper speech, Turkish financial terms" if locale == "tr" else "quiet whisper speech"
            kwargs["temperature"] = 0.2
        response = await self.client.audio.transcriptions.create(**kwargs)
        return response.text

    async def _parse_with_llm(self, text: str, locale: str = "tr", whisper_mode: bool = False) -> ParsedInput:
        prompt = SYSTEM_PROMPT_EN if locale == "en" else SYSTEM_PROMPT_TR
        if whisper_mode:
            prompt += "\n\nNote: Input may be quiet/whispered speech with unclear words. Infer intent generously."
        response = await self.client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            temperature=0.2 if whisper_mode else 0.5,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": text},
            ],
        )
        data = json.loads(response.choices[0].message.content)
        return ParsedInput(raw_text=text, **data)

    def _parse_locally(self, text: str, whisper_mode: bool = False) -> ParsedInput:
        intent = detect_intent(text)
        if text.startswith("/"):
            text = text[1:].strip()
            parts = text.split(maxsplit=2)
            amount = Decimal(parts[0]) if parts and parts[0].replace(".", "").isdigit() else parse_turkish_amount(text)
            category = parts[1] if len(parts) > 1 else extract_category(text)
            wallet = parts[2] if len(parts) > 2 else extract_wallet_name(text)
            return ParsedInput(
                intent="add_expense",
                amount=amount,
                category=category,
                wallet_name=wallet,
                description=text,
                raw_text=text,
            )

        person_count = None
        count_match = re.search(r"(\d+)\s*kişi", text.lower())
        if count_match:
            person_count = int(count_match.group(1))

        text_lower = text.lower()
        is_recurring = any(w in text_lower for w in ["her ay", "aylık", "aylik", "tekrarlayan"])

        return ParsedInput(
            intent=intent,
            amount=parse_turkish_amount(text),
            category=extract_category(text),
            wallet_name=extract_wallet_name(text),
            items=extract_shopping_items(text),
            description=text,
            person_count=person_count,
            date=extract_date(text),
            is_recurring=is_recurring,
            raw_text=text,
            confidence=0.85 if whisper_mode else 1.0,
        )

    def _parse_locally_en(self, text: str) -> ParsedInput:
        lower = text.lower()
        intent = "add_expense"
        if any(w in lower for w in ["add to list", "shopping", "buy"]):
            intent = "add_shopping"
        elif any(w in lower for w in ["paid", "mark paid"]):
            intent = "mark_paid"
        elif any(w in lower for w in ["income", "salary", "deposit"]):
            intent = "add_income"
        elif "transfer" in lower:
            intent = "transfer"

        amount = None
        amount_match = re.search(r"(\d+(?:\.\d+)?)", text)
        if amount_match:
            amount = Decimal(amount_match.group(1))

        if text.startswith("/"):
            text = text[1:].strip()
            parts = text.split(maxsplit=2)
            if parts and parts[0].replace(".", "").isdigit():
                amount = Decimal(parts[0])
            return ParsedInput(
                intent="add_expense",
                amount=amount,
                category=parts[1] if len(parts) > 1 else None,
                wallet_name=parts[2] if len(parts) > 2 else "Bank",
                description=text,
                raw_text=text,
            )

        return ParsedInput(
            intent=intent,
            amount=amount,
            category=None,
            wallet_name="Cash" if "cash" in lower else "Bank",
            description=text,
            raw_text=text,
        )

    def build_confirmation(self, parsed: ParsedInput, lang: str = "tr") -> str:
        if parsed.intent == "add_expense":
            return t("confirm.expense", lang, amount=parsed.amount, currency=parsed.currency,
                       category=parsed.category, description=parsed.description or parsed.place or "")
        if parsed.intent == "add_shopping":
            items = ", ".join(parsed.items) if parsed.items else parsed.description
            return t("confirm.shopping", lang, items=items)
        if parsed.intent == "transfer":
            return t("confirm.transfer", lang, amount=parsed.amount, currency=parsed.currency,
                     from_wallet=parsed.wallet_name, to_wallet=parsed.target_wallet_name)
        if parsed.intent == "add_income":
            wallet = parsed.wallet_name or ("Bank" if lang == "en" else "Banka")
            return t("confirm.income", lang, amount=parsed.amount, currency=parsed.currency, wallet=wallet)
        if parsed.intent == "mark_paid":
            return t("confirm.paid", lang, description=parsed.description)
        if parsed.intent == "add_bill":
            desc = parsed.description or ("Bill" if lang == "en" else "Fatura")
            return t("confirm.bill", lang, amount=parsed.amount, currency=parsed.currency, description=desc)
        return f"{parsed.description or parsed.raw_text}?"
