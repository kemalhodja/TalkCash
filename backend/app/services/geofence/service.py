import json
import math
from pathlib import Path

from app.config import settings
from app.services.geofence.overpass import fetch_osm_markets
from app.utils.redis_client import cache_get, cache_set

POI_FILE = Path(__file__).resolve().parents[2] / "data" / "market_pois.json"
MAX_RESULTS = 20
EARTH_RADIUS_KM = 6371.0
DEDUPE_KM = 0.05


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _load_static_pois() -> list[dict]:
    pois = json.loads(POI_FILE.read_text(encoding="utf-8"))
    return [{**p, "source": "static"} for p in pois]


def _score_and_filter(pois: list[dict], lat: float, lng: float, radius_km: float) -> list[dict]:
    scored = []
    for poi in pois:
        dist = _haversine_km(lat, lng, poi["lat"], poi["lng"])
        if dist <= radius_km:
            scored.append({**poi, "distance_km": round(dist, 3)})
    scored.sort(key=lambda x: x["distance_km"])
    return scored


def _dedupe_markets(markets: list[dict]) -> list[dict]:
    unique: list[dict] = []
    for m in markets:
        if any(_haversine_km(m["lat"], m["lng"], u["lat"], u["lng"]) < DEDUPE_KM for u in unique):
            continue
        unique.append(m)
    return unique


def _cache_key(lat: float, lng: float, radius_km: float) -> str:
    return f"geofence:{round(lat, 3)}:{round(lng, 3)}:{radius_km}"


class GeofenceService:
    async def nearby_markets(
        self,
        lat: float,
        lng: float,
        radius_km: float = 2.0,
        limit: int = MAX_RESULTS,
        use_osm: bool = True,
    ) -> tuple[list[dict], str]:
        cache_key = _cache_key(lat, lng, radius_km)
        cached = await cache_get(cache_key)
        if cached:
            return cached["markets"], cached["source"]

        static = _load_static_pois()
        combined = list(static)

        if use_osm and settings.overpass_enabled:
            osm_markets = await fetch_osm_markets(lat, lng, radius_km)
            combined.extend(osm_markets)

        combined = _dedupe_markets(combined)
        scored = _score_and_filter(combined, lat, lng, radius_km)

        if not scored and radius_km < 10:
            return await self.nearby_markets(lat, lng, radius_km=10, limit=limit, use_osm=use_osm)

        source = "osm+static" if use_osm and settings.overpass_enabled else "static"
        if scored and all(m.get("source") == "static" for m in scored):
            source = "static"
        elif scored and all(m.get("source") == "osm" for m in scored):
            source = "osm"

        result = scored[:limit]
        await cache_set(cache_key, {"markets": result, "source": source}, ttl=settings.geofence_cache_ttl)
        return result, source

    def nearby_markets_sync(
        self, lat: float, lng: float, radius_km: float = 2.0, limit: int = MAX_RESULTS,
    ) -> list[dict]:
        """Synchronous fallback using static POIs only (for unit tests without async)."""
        static = _load_static_pois()
        scored = _score_and_filter(static, lat, lng, radius_km)
        if not scored and radius_km < 10:
            return self.nearby_markets_sync(lat, lng, radius_km=10, limit=limit)
        return scored[:limit]
