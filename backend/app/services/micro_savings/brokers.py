from urllib.parse import urlencode

from app.config import settings


def _broker_catalog() -> list[dict]:
    return [
        {
            "id": "midas",
            "name_tr": "Midas",
            "name_en": "Midas",
            "description_tr": "ABD ve BIST hisselerine erişim",
            "description_en": "Access to US and BIST stocks",
            "web_url": settings.broker_midas_url,
            "android_package": "com.getmidas.app",
            "ios_scheme": "midas://",
            "regions": ("tr", "global"),
        },
        {
            "id": "papara",
            "name_tr": "Papara Yatırım",
            "name_en": "Papara Invest",
            "description_tr": "Fon ve yatırım ürünleri",
            "description_en": "Funds and investment products",
            "web_url": settings.broker_papara_url,
            "android_package": "com.mobillium.papara",
            "ios_scheme": "papara://",
            "regions": ("tr",),
        },
        {
            "id": "revolut",
            "name_tr": "Revolut",
            "name_en": "Revolut",
            "description_tr": "Döviz ve yatırım hesabı",
            "description_en": "Multi-currency and investing",
            "web_url": settings.broker_revolut_url,
            "android_package": "com.revolut.revolut",
            "ios_scheme": "revolut://",
            "regions": ("global",),
        },
        {
            "id": "trading212",
            "name_tr": "Trading 212",
            "name_en": "Trading 212",
            "description_tr": "Komisyonsuz hisse ve ETF",
            "description_en": "Commission-free stocks and ETFs",
            "web_url": settings.broker_trading212_url,
            "android_package": "com.avuscapital.trading212",
            "ios_scheme": "trading212://",
            "regions": ("global",),
        },
    ]


def build_broker_open_url(broker: dict, *, amount_try: float | None = None, locale: str = "tr") -> str:
    base = broker.get("web_url") or ""
    params: dict[str, str] = {"utm_source": "talkcash", "utm_medium": "app"}
    if amount_try and amount_try > 0:
        params["ref_amount"] = f"{amount_try:.0f}"
        params["utm_campaign"] = "micro_savings"
    if locale == "en":
        params["lang"] = "en"
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}{urlencode(params)}"


def list_brokers(locale: str = "tr") -> list[dict]:
    name_key = "name_tr" if locale == "tr" else "name_en"
    desc_key = "description_tr" if locale == "tr" else "description_en"
    region = "tr" if locale == "tr" else "global"
    items: list[dict] = []
    for b in _broker_catalog():
        regions = b.get("regions", ("tr", "global"))
        if region not in regions and "global" not in regions:
            continue
        payload = {
            "id": b["id"],
            "name": b[name_key],
            "description": b[desc_key],
            "web_url": b["web_url"],
            "android_package": b.get("android_package"),
            "ios_scheme": b.get("ios_scheme"),
        }
        payload["open_url"] = build_broker_open_url(payload, locale=locale)
        items.append(payload)
    return items


def broker_by_id(broker_id: str, locale: str = "tr", *, amount_try: float | None = None) -> dict | None:
    for item in list_brokers(locale):
        if item["id"] == broker_id:
            if amount_try:
                item = dict(item)
                item["open_url"] = build_broker_open_url(item, amount_try=amount_try, locale=locale)
            return item
    return None
