import re
from decimal import Decimal

from openai import AsyncOpenAI

from app.config import settings
from app.i18n import t
from app.schemas.common import ParsedInput
from app.utils.json_safe import safe_parse_json
from app.services.nlp.english_parser import (
    extract_date_en,
    extract_installment_count as extract_installment_count_en,
    extract_target_wallet_en,
    parse_english_amount,
)
from app.services.nlp.personas import nlp_persona_overlay, normalize_persona
from app.services.subscription.manager import detect_subscription
from app.services.nlp.stt import transcribe_audio as stt_transcribe_audio
from app.services.nlp.turkish_parser import (
    detect_easter_egg,
    detect_intent,
    extract_category,
    extract_date,
    extract_installment_count,
    extract_paid_bill_title,
    extract_shopping_items,
    extract_store_name,
    extract_target_wallet,
    extract_wallet_name,
    parse_turkish_amount,
)

SYSTEM_PROMPT_TR = """Sen TalkCash finans uygulamasının NLP motorusun.
Kullanıcının Türkçe doğal dil girdisini analiz edip JSON döndür.

Desteklenen intent'ler:
- add_expense, add_income, transfer, add_bill, add_task, add_installment
- add_shopping, mark_paid, add_debt, split_bill

Mağaza adını store_name alanına yaz (Bim, Şok, Migros, Carrefour, Mahalle Bakkalı vb.).

Yerel ifadeleri sayıya çevir: "200 kağıt"=200, "elli lira"=50, "yüzlük gömdük"=100

JSON formatı:
{
  "intent": "string",
  "amount": number|null,
  "currency": "TRY",
  "category": "string|null",
  "description": "string|null",
  "place": "string|null",
  "store_name": "string|null",
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
- add_expense, add_income, transfer, add_bill, add_task, add_installment
- add_shopping, mark_paid, add_debt, split_bill

Extract store/merchant name into store_name (e.g. Bim, Migros, Carrefour, local grocery).

JSON format:
{
  "intent": "string",
  "amount": number|null,
  "currency": "TRY",
  "category": "string|null",
  "description": "string|null",
  "place": "string|null",
  "store_name": "string|null",
  "wallet_name": "string|null",
  "target_wallet_name": "string|null",
  "items": ["string"],
  "person_name": "string|null",
  "installment_count": number|null,
  "date": "ISO-8601 datetime string|null",
  "confidence": 0.0-1.0
}"""


SMS_PROMPT_TR = """Bu bir banka harcama SMS veya bildirim metnidir.
Tutar, tarih ve mekan/açıklama bilgisini ayıkla.
JSON döndür:
{"intent":"add_expense","amount":number|null,"currency":"TRY","category":"Genel","description":"string","date":"ISO-8601|null","confidence":0.0-1.0}"""

SMS_PROMPT_EN = """This is a bank expense SMS or notification text.
Extract amount, date, and merchant/description.
Return JSON:
{"intent":"add_expense","amount":number|null,"currency":"TRY","category":"Genel","description":"string","date":"ISO-8601|null","confidence":0.0-1.0}"""


class NLPEngine:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    async def parse_text(self, text: str, whisper_mode: bool = False, locale: str = "tr", persona: str = "default") -> ParsedInput:
        egg = detect_easter_egg(text, locale)
        if egg:
            return ParsedInput(intent="easter_egg", description=egg, raw_text=text, confidence=1.0)
        if self.client:
            try:
                return await self._parse_with_llm(text, locale, whisper_mode=whisper_mode, persona=persona)
            except Exception:
                pass
        if locale == "en":
            return self._parse_locally_en(text)
        return self._parse_locally(text, whisper_mode=whisper_mode)

    async def transcribe_audio(self, audio_bytes: bytes, whisper_mode: bool = False, locale: str = "tr") -> str:
        return await stt_transcribe_audio(audio_bytes, whisper_mode=whisper_mode, locale=locale)

    def _manual_edit_fallback(self, text: str) -> ParsedInput:
        return ParsedInput(
            intent="manual_edit",
            raw_text=text,
            description=text,
            confidence=0.0,
            parse_failed=True,
        )

    def _build_parsed_from_llm(self, text: str, data: dict) -> ParsedInput:
        if not data.get("intent"):
            return self._manual_edit_fallback(text)
        allowed = set(ParsedInput.model_fields.keys()) - {"parse_failed"}
        filtered = {k: v for k, v in data.items() if k in allowed}
        return ParsedInput(raw_text=text, **filtered)

    async def parse_sms(self, text: str, locale: str = "tr", persona: str = "default") -> ParsedInput:
        if self.client:
            try:
                return await self._parse_sms_llm(text, locale, persona)
            except Exception:
                pass
        parsed = self._parse_sms_regex(text)
        is_sub, sub_name = detect_subscription(text)
        if is_sub:
            parsed.is_subscription = True
            parsed.is_recurring = True
            parsed.subscription_name = sub_name
        return parsed

    async def _parse_sms_llm(self, text: str, locale: str = "tr", persona: str = "default") -> ParsedInput:
        prompt = SMS_PROMPT_EN if locale == "en" else SMS_PROMPT_TR
        prompt += nlp_persona_overlay(normalize_persona(persona), locale)
        try:
            response = await self.client.chat.completions.create(
                model=settings.openai_model,
                response_format={"type": "json_object"},
                temperature=0.1,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": text},
                ],
            )
            data = safe_parse_json(response.choices[0].message.content)
            if not data.get("intent"):
                raise ValueError("invalid sms llm json")
            return self._build_parsed_from_llm(text, data)
        except Exception:
            return self._parse_sms_regex(text)

    def _parse_sms_regex(self, text: str) -> ParsedInput:
        amount = parse_turkish_amount(text)
        return ParsedInput(
            intent="add_expense",
            amount=amount,
            category="Genel",
            description=text[:120],
            date=extract_date(text),
            raw_text=text,
            confidence=0.7,
        )

    async def _parse_with_llm(self, text: str, locale: str = "tr", whisper_mode: bool = False, persona: str = "default") -> ParsedInput:
        prompt = SYSTEM_PROMPT_EN if locale == "en" else SYSTEM_PROMPT_TR
        prompt += nlp_persona_overlay(normalize_persona(persona), locale)
        if whisper_mode:
            prompt += "\n\nNote: Input may be quiet/whispered speech with unclear words. Infer intent generously."
        try:
            response = await self.client.chat.completions.create(
                model=settings.openai_model,
                response_format={"type": "json_object"},
                temperature=0.2 if whisper_mode else 0.5,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": text},
                ],
            )
            data = safe_parse_json(response.choices[0].message.content)
            if not data.get("intent"):
                return self._manual_edit_fallback(text)
            return self._build_parsed_from_llm(text, data)
        except Exception:
            return self._manual_edit_fallback(text)

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

        description = extract_paid_bill_title(text) if intent == "mark_paid" else text
        wallet = extract_wallet_name(text)
        target = extract_target_wallet(text) if intent == "transfer" else None
        store = extract_store_name(text)
        is_sub, sub_name = detect_subscription(text)
        return ParsedInput(
            intent=intent,
            amount=parse_turkish_amount(text),
            category=extract_category(text),
            wallet_name=wallet,
            target_wallet_name=target,
            items=extract_shopping_items(text),
            description=description,
            place=store,
            store_name=store,
            person_count=person_count,
            date=extract_date(text),
            installment_count=extract_installment_count(text),
            is_recurring=is_recurring or is_sub,
            is_subscription=is_sub,
            subscription_name=sub_name,
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

        amount = parse_english_amount(text)
        if amount is None:
            amount_match = re.search(r"(\d+(?:\.\d+)?)", text)
            if amount_match:
                amount = Decimal(amount_match.group(1))

        description = text
        if intent == "mark_paid":
            description = re.sub(r"(?i)\b(paid|mark paid|i paid)\b", "", text).strip() or text

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

        target = extract_target_wallet_en(text) if intent == "transfer" else None
        wallet = "Cash" if "cash" in lower else "Bank"
        if intent == "transfer" and "from bank" in lower:
            wallet = "Bank"
        is_sub, sub_name = detect_subscription(text)
        is_recurring = any(w in lower for w in ["monthly", "every month", "recurring"])
        return ParsedInput(
            intent=intent,
            amount=amount,
            category=None,
            wallet_name=wallet,
            target_wallet_name=target,
            description=description,
            date=extract_date_en(text),
            installment_count=extract_installment_count_en(text),
            is_recurring=is_recurring or is_sub,
            is_subscription=is_sub,
            subscription_name=sub_name,
            raw_text=text,
        )

    def build_confirmation(self, parsed: ParsedInput, lang: str = "tr") -> str:
        if parsed.intent == "manual_edit" or parsed.parse_failed:
            return t("confirm.manual_edit", lang)
        if parsed.intent == "easter_egg":
            return parsed.description or t("nlp.easter_egg", lang)
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
