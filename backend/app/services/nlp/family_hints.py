"""Aile / ortak bütçe paylaşım ipuçları."""

FAMILY_SHARE_HINTS = (
    "ortak bütçe",
    "ortak hesap",
    "aile bütç",
    "aile için",
    "ev için",
    "eve ",
    "ortak cüzdan",
    "shared budget",
    "family budget",
    "for home",
    "our home",
)


def detect_share_to_family(text: str) -> bool:
    lowered = (text or "").lower()
    return any(h in lowered for h in FAMILY_SHARE_HINTS)
