import json
from pathlib import Path

_LOCALES: dict[str, dict[str, str]] = {}
_LOCALE_DIR = Path(__file__).parent / "locales"


class I18nError(ValueError):
    def __init__(self, key: str, **kwargs):
        self.key = key
        self.kwargs = kwargs
        super().__init__(key)


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


def locale_from_request(request) -> str:
    lang = request.headers.get("Accept-Language", "tr")[:2]
    return lang if lang in SUPPORTED_LOCALES else "tr"


def maybe_translate(text: str, lang: str) -> str:
    if not isinstance(text, str):
        return text
    messages = _load_locale(lang)
    if text in messages:
        return messages[text]
    return text


def resolve_error(exc: Exception, lang: str) -> str:
    if isinstance(exc, I18nError):
        return t(exc.key, lang, **exc.kwargs)
    return maybe_translate(str(exc), lang)


SUPPORTED_LOCALES = ["tr", "en"]
