import json
import math
from pathlib import Path

POI_FILE = Path(__file__).resolve().parents[2] / "data" / "market_pois.json"
MAX_RESULTS = 20
EARTH_RADIUS_KM = 6371.0


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _load_pois() -> list[dict]:
    return json.loads(POI_FILE.read_text(encoding="utf-8"))


class GeofenceService:
    def nearby_markets(
        self, lat: float, lng: float, radius_km: float = 2.0, limit: int = MAX_RESULTS,
    ) -> list[dict]:
        pois = _load_pois()
        scored = []
        for poi in pois:
            dist = _haversine_km(lat, lng, poi["lat"], poi["lng"])
            if dist <= radius_km:
                scored.append({**poi, "distance_km": round(dist, 3)})

        if not scored and radius_km < 10:
            return self.nearby_markets(lat, lng, radius_km=10, limit=limit)

        scored.sort(key=lambda x: x["distance_km"])
        return scored[:limit]
