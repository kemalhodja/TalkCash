import json
from pathlib import Path

_LOCALES: dict[str, dict[str, str]] = {}
_LOCALE_DIR = Path(__file__).parent / "locales"


def _load_locale(lang: str) -> dict[str, str]:
    if lang not in _LOCALES:
        path = _LOCALE_DIR / f"{lang}.json"
        if not path.exists():
            path = _LOCALE_DIR / "tr.json"
        _LOCALES[lang] = json.loads(path.read_text(encoding="utf-8"))
    return _LOCALES[lang]


def t(key: str, lang: str = "tr", **kwargs) -> str:
    messages = _load_locale(lang)
    text = messages.get(key, _load_locale("tr").get(key, key))
    if kwargs:
        try:
            return text.format(**kwargs)
        except (KeyError, ValueError):
            return text
    return text


SUPPORTED_LOCALES = ["tr", "en"]
