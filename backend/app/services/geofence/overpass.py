import logging
import re

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
KNOWN_CHAINS = ("bim", "bİm", "migros", "a101", "şok", "sok", "carrefour", "metro", "hakmar", "file", "macrocenter")

CHAIN_NORMALIZE = {
    "bim": "BİM", "bİm": "BİM",
    "migros": "Migros", "a101": "A101",
    "şok": "Şok", "sok": "Şok",
    "carrefour": "CarrefourSA", "carrefoursa": "CarrefourSA",
    "metro": "Metro", "hakmar": "Hakmar",
    "file": "File", "macrocenter": "Macrocenter",
}


def _normalize_chain(brand: str | None, name: str) -> str:
    raw = (brand or name or "Market").strip()
    key = raw.lower().replace(" ", "")
    for k, v in CHAIN_NORMALIZE.items():
        if k in key:
            return v
    return raw[:40] or "Market"


def _parse_element(element: dict) -> dict | None:
    tags = element.get("tags") or {}
    if element.get("type") == "node":
        lat, lng = element.get("lat"), element.get("lon")
    elif "center" in element:
        lat, lng = element["center"].get("lat"), element["center"].get("lon")
    else:
        return None
    if lat is None or lng is None:
        return None

    name = tags.get("name") or tags.get("brand") or tags.get("operator") or "Market"
    chain = _normalize_chain(tags.get("brand"), name)
    osm_type = element.get("type", "node")
    osm_id = element.get("id", 0)
    safe_name = re.sub(r"[^\w\s-]", "", name)[:50]

    return {
        "id": f"osm-{osm_type}-{osm_id}",
        "name": safe_name,
        "chain": chain,
        "lat": float(lat),
        "lng": float(lng),
        "source": "osm",
    }


def _build_query(lat: float, lng: float, radius_m: int) -> str:
    return f"""
[out:json][timeout:25];
(
  node["shop"~"supermarket|convenience|grocery"](around:{radius_m},{lat},{lng});
  way["shop"~"supermarket|convenience|grocery"](around:{radius_m},{lat},{lng});
);
out center tags;
""".strip()


async def fetch_osm_markets(lat: float, lng: float, radius_km: float = 2.0) -> list[dict]:
    if not settings.overpass_enabled:
        return []

    radius_m = int(min(radius_km, 5) * 1000)
    query = _build_query(lat, lng, radius_m)
    url = settings.overpass_url or OVERPASS_URL

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, data={"data": query})
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("Overpass API failed: %s", exc)
        return []

    markets = []
    for el in data.get("elements", []):
        parsed = _parse_element(el)
        if parsed:
            markets.append(parsed)
    return markets
