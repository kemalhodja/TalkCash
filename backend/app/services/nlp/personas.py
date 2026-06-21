"""Dynamic LLM/TTS persona overlays for TalkCash assistant."""

from typing import Literal

PersonaKey = Literal["default", "angry_mom", "street_smart"]

VALID_PERSONAS: frozenset[str] = frozenset({"default", "angry_mom", "street_smart"})

LUXURY_KEYWORDS = (
    "kahve", "coffee", "starbucks", "cafe", "kafe", "restaurant", "restoran",
    "yemek", "delivery", "sipariş", "siparis", "taxi", "taksi", "uber", "bolt",
    "netflix", "spotify", "premium", "lüks", "luks", "getir", "yemeksepeti",
    "trendyol", "amazon", "shopping", "alışveriş", "alisveris",
)

COFFEE_KEYWORDS = ("kahve", "coffee", "starbucks", "cafe", "kafe", "latte", "espresso")
TAXI_KEYWORDS = ("taxi", "taksi", "uber", "bolt", "bitaksi", "bi taxi")
DELIVERY_KEYWORDS = ("getir", "yemeksepeti", "delivery", "sipariş", "siparis", "dominos", "pizza")


def normalize_persona(value: str | None) -> PersonaKey:
    key = (value or "default").strip().lower()
    return key if key in VALID_PERSONAS else "default"  # type: ignore[return-value]


def nlp_persona_overlay(persona: PersonaKey, locale: str) -> str:
    if persona == "default":
        return ""
    if persona == "angry_mom":
        return (
            "\n\nPersona: Agresif Anne — harcama açıklamalarında sert ama sevgi dolu, esprili uyarı tonu kullan."
            if locale == "tr"
            else "\n\nPersona: Strict Mom — use firm but caring, witty warnings about spending."
        )
    return (
        "\n\nPersona: Sokak Aklı — samimi, direkt, argo olmayan sokak diliyle konuş."
        if locale == "tr"
        else "\n\nPersona: Street Smart — casual, direct, no-nonsense tone."
    )


def mentor_persona_overlay(persona: PersonaKey, locale: str) -> str:
    """Overlay for AI mentor chat — consistent with expense TTS persona."""
    if persona == "default":
        return ""
    if persona == "angry_mom":
        return (
            "\n\nKişilik: Agresif Anne — kısa yanıtlarda sert ama şefkatli, esprili uyarı tonu kullan."
            if locale == "tr"
            else "\n\nPersona: Strict Mom — brief, witty, caring-but-firm money advice."
        )
    return (
        "\n\nKişilik: Sokak Aklı — samimi, direkt, argo olmadan konuş."
        if locale == "tr"
        else "\n\nPersona: Street Smart — casual, direct, no fluff."
    )


def _blob(category: str | None, description: str | None, raw_text: str | None) -> str:
    return f"{category or ''} {description or ''} {raw_text or ''}".lower()


def is_luxury_spend(category: str | None, description: str | None, raw_text: str | None) -> bool:
    return any(k in _blob(category, description, raw_text) for k in LUXURY_KEYWORDS)


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
    name_part = f"{name}" if name else ""
    cat = category or "harcama"
    blob = _blob(category, description, raw_text)
    amt = f"{amount:.0f}"

    if persona == "angry_mom":
        if locale == "en":
            if budget_exceeded:
                return f"{name_part}, you're over budget again! That {cat} of {amt} TRY? We talked about this!"
            if _match_any(blob, COFFEE_KEYWORDS):
                return f"{name_part}, coffee outside again? Make it at home! This {amt} TRY won't help you survive the month!"
            if _match_any(blob, TAXI_KEYWORDS):
                return f"{name_part}, couldn't you walk or take the bus? {amt} TRY for a ride — your wallet is tired!"
            if _match_any(blob, DELIVERY_KEYWORDS):
                return f"{name_part}, order delivery again? Cook at home! {amt} TRY {cat} — that's real money!"
            return f"{name_part}, another {amt} TRY on {cat}? This month won't end well at this rate!"
        if budget_exceeded:
            return f"{name_part}, yine bütçeyi aştın! Bu {amt} TL {cat} harcaması ne olacak şimdi?"
        if _match_any(blob, COFFEE_KEYWORDS):
            return (
                f"{name_part}, yine mi dışarıda kahve içtin? Evde kahve mi yok evladım? "
                f"Bu {amt} TL ile ay sonunu getiremeyeceksin!"
            )
        if _match_any(blob, TAXI_KEYWORDS):
            return f"{name_part}, yürüyemez miydin evladım? {amt} TL taksi — cüzdanın ağlıyor!"
        if _match_any(blob, DELIVERY_KEYWORDS):
            return f"{name_part}, yine mi sipariş? Mutfağa gir bir zahmet! {amt} TL {cat} — parayı çöpe atıyorsun!"
        return f"{name_part}, yine {amt} TL {cat} mı? Bu gidişle ay sonunu zor getirirsin!"

    # street_smart
    if locale == "en":
        if budget_exceeded:
            return f"Yo {name_part}, budget's busted. {amt} TRY on {cat}? Pump the brakes."
        if _match_any(blob, COFFEE_KEYWORDS):
            return f"Bro {name_part}, {amt} TRY coffee? Your kitchen exists. Use it."
        if _match_any(blob, TAXI_KEYWORDS):
            return f"{name_part}, {amt} TRY ride? Could've saved that. Just saying."
        return f"Yo {name_part}, {amt} TRY on {cat}? Wallet's crying. Chill on the treats."
    if budget_exceeded:
        return f"Aga {name_part}, bütçe patladı. {amt} TL {cat}? Frenle biraz."
    if _match_any(blob, COFFEE_KEYWORDS):
        return f"Aga {name_part}, {amt} TL kahve mi? Evde makine var, kullan."
    if _match_any(blob, TAXI_KEYWORDS):
        return f"{name_part}, {amt} TL taksi? Yürü biraz, cüzdan rahatlasın."
    return f"Aga {name_part}, {amt} TL {cat} mı? Cüzdan ağlıyor. Biraz frenle kendini."
