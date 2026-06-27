"""Dynamic LLM/TTS persona overlays for TalkCash assistant."""

from typing import Literal

from app.services.nlp.master_prompts import (
    PersonaKey,
    mentor_system_prompt,
    nlp_persona_master,
)

VALID_PERSONAS: frozenset[str] = frozenset({"default", "angry_mom", "street_smart", "wall_street", "zen_guru"})

LUXURY_KEYWORDS = (
    "kahve", "coffee", "starbucks", "cafe", "kafe", "restaurant", "restoran",
    "yemek", "delivery", "sipariş", "siparis", "taxi", "taksi", "uber", "bolt",
    "netflix", "spotify", "premium", "lüks", "luks", "getir", "yemeksepeti",
    "trendyol", "amazon", "shopping", "alışveriş", "alisveris",
)

ESSENTIAL_KEYWORDS = (
    "fatura", "kira", "market", "elektrik", "su", "doğalgaz", "dogalgaz", "aidat",
    "rent", "bill", "utility", "grocery", "groceries", "mortgage", "sigorta", "insurance",
    "faturalar", "kira ödeme", "market alışveriş",
)

COFFEE_KEYWORDS = ("kahve", "coffee", "starbucks", "cafe", "kafe", "latte", "espresso")
TAXI_KEYWORDS = ("taxi", "taksi", "uber", "bolt", "bitaksi", "bi taxi")
DELIVERY_KEYWORDS = ("getir", "yemeksepeti", "delivery", "sipariş", "siparis", "dominos", "pizza")

# Illustrative 5-year compound factor for Wall Street persona (educational only)
_WALL_STREET_5Y_FACTOR = 1.85


def normalize_persona(value: str | None) -> PersonaKey:
    key = (value or "default").strip().lower()
    return key if key in VALID_PERSONAS else "default"  # type: ignore[return-value]


def nlp_persona_overlay(persona: PersonaKey, locale: str) -> str:
    return nlp_persona_master(persona, locale)


def mentor_persona_overlay(persona: PersonaKey, locale: str) -> str:
    """Deprecated — use mentor_system_prompt from master_prompts."""
    if persona == "default":
        return ""
    return nlp_persona_master(persona, locale)


def _blob(category: str | None, description: str | None, raw_text: str | None) -> str:
    return f"{category or ''} {description or ''} {raw_text or ''}".lower()


def is_luxury_spend(category: str | None, description: str | None, raw_text: str | None) -> bool:
    return any(k in _blob(category, description, raw_text) for k in LUXURY_KEYWORDS)


def is_essential_spend(category: str | None, description: str | None, raw_text: str | None) -> bool:
    return any(k in _blob(category, description, raw_text) for k in ESSENTIAL_KEYWORDS)


def _match_any(blob: str, keywords: tuple[str, ...]) -> bool:
    return any(k in blob for k in keywords)


def persona_spend_speech(
    persona: PersonaKey,
    locale: str,
    *,
    user_name: str,
    category: str,
    amount: float,
    budget_exceeded: bool = False,
    description: str | None = None,
    raw_text: str | None = None,
) -> str | None:
    if persona == "default":
        return None
    name = user_name.split()[0] if user_name.strip() else ""
    name_part = f"{name}" if name else "evladım"
    cat = category or "harcama"
    blob = _blob(category, description, raw_text)
    amt = f"{amount:.0f}"
    essential = is_essential_spend(category, description, raw_text)

    if persona == "zen_guru":
        if locale == "en":
            return (
                f"{name_part}, breathe. {amt} on {cat}. "
                f"Will this bring lasting peace — or only fill a momentary void?"
            )
        return (
            f"{name_part}, derin bir nefes al. {amt} TL {cat}. "
            f"Bu satın alma sana uzun vadeli huzur mu getirecek, yoksa anlık bir boşluğu mu dolduruyor?"
        )

    if persona == "wall_street":
        projected = amount * _WALL_STREET_5Y_FACTOR
        if essential:
            if locale == "en":
                return f"{name_part}, necessary {cat} — fine. But every lira not invested is time lost."
            return f"{name_part}, zorunlu {cat} — tamam. Ama yatırıma gitmeyen her lira kayıp zaman."
        if locale == "en":
            return (
                f"{name_part}, {amt} on {cat}? Put that in a fund for 5 years — "
                f"~{projected:.0f} illustrative. Do you know what you're giving up? You're wasting time!"
            )
        return (
            f"{name_part}, {amt} TL {cat} mı? Bu parayı fona koysaydın 5 yıl sonra "
            f"~{projected:.0f} TL olabilirdi — haberin var mı? Zaman kaybediyorsun!"
        )

    if persona == "angry_mom":
        if essential and not budget_exceeded:
            if locale == "en":
                return f"{name_part}, good — keep up with {cat}. Just don't splurge on luxuries."
            return f"{name_part}, aferin, {cat} aksatma. Ama lükse kaçma, tamam mı?"
        if locale == "en":
            if budget_exceeded:
                return f"{name_part}, over budget again! {amt} on {cat}? We talked about this!"
            if _match_any(blob, COFFEE_KEYWORDS):
                return f"{name_part}, coffee outside again? Is there no food at home? {amt} TRY — pick money off the street?"
            if _match_any(blob, DELIVERY_KEYWORDS):
                return f"{name_part}, delivery again? {amt} TRY — do you pick money off the street?"
            return f"{name_part}, {amt} TRY on {cat}? Evde yemek yok mu sanki?"
        if budget_exceeded:
            return f"{name_part}, yine bütçeyi aştın! {amt} TL {cat} — parayı sokaktan mı topluyorsun?"
        if _match_any(blob, COFFEE_KEYWORDS):
            return (
                f"{name_part}, kahveye {amt} TL mi? Evde yemek mi yok? "
                f"Parayı sokaktan mı topluyorsun evladım!"
            )
        if _match_any(blob, DELIVERY_KEYWORDS):
            return (
                f"{name_part}, dışarıdan {amt} TL yemek mi? Mutfağa gir! "
                f"Evde yemek mi yok?"
            )
        if _match_any(blob, TAXI_KEYWORDS):
            return f"{name_part}, {amt} TL taksi? Yürüsene biraz evladım!"
        return f"{name_part}, {amt} TL {cat} mı? Evde yemek mi yok, parayı sokaktan mı topluyorsun?"

    # street_smart
    if locale == "en":
        if budget_exceeded:
            return f"Yo {name_part}, budget's busted. {amt} on {cat}? Pump the brakes."
        if _match_any(blob, COFFEE_KEYWORDS):
            return f"Bro {name_part}, {amt} coffee? Your kitchen exists."
        return f"Yo {name_part}, {amt} on {cat}? Wallet's crying."
    if budget_exceeded:
        return f"Aga {name_part}, bütçe patladı. {amt} TL {cat}? Frenle biraz."
    if _match_any(blob, COFFEE_KEYWORDS):
        return f"Aga {name_part}, {amt} TL kahve mi? Evde makine var."
    return f"Aga {name_part}, {amt} TL {cat} mı? Cüzdan ağlıyor."


__all__ = [
    "PersonaKey",
    "VALID_PERSONAS",
    "normalize_persona",
    "nlp_persona_overlay",
    "mentor_persona_overlay",
    "mentor_system_prompt",
    "persona_spend_speech",
    "is_luxury_spend",
    "is_essential_spend",
]
