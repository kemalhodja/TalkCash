from unittest.mock import AsyncMock, patch

import pytest

from app.services.geofence.overpass import _parse_element, _normalize_chain
from app.services.geofence.service import GeofenceService, _dedupe_markets


def test_nearby_markets_istanbul_sync():
    service = GeofenceService()
    markets = service.nearby_markets_sync(40.9902, 29.0298, radius_km=2)
    assert len(markets) >= 1
    assert all("distance_km" in m for m in markets)
    assert markets[0]["distance_km"] <= 2


def test_nearby_markets_expands_radius_sync():
    service = GeofenceService()
    markets = service.nearby_markets_sync(41.0, 29.0, radius_km=2)
    assert len(markets) >= 1


def test_haversine_ordering_sync():
    service = GeofenceService()
    markets = service.nearby_markets_sync(40.9902, 29.0298, radius_km=5)
    distances = [m["distance_km"] for m in markets]
    assert distances == sorted(distances)


def test_static_poi_database_size():
    from pathlib import Path
    import json
    pois = json.loads((Path(__file__).parents[1] / "app/data/market_pois.json").read_text(encoding="utf-8"))
    assert len(pois) >= 80


def test_parse_osm_element():
    el = {
        "type": "node", "id": 12345,
        "lat": 40.99, "lon": 29.03,
        "tags": {"name": "BİM", "brand": "BİM", "shop": "supermarket"},
    }
    parsed = _parse_element(el)
    assert parsed is not None
    assert parsed["id"] == "osm-node-12345"
    assert parsed["source"] == "osm"
    assert parsed["chain"] == "BİM"


def test_normalize_chain():
    assert _normalize_chain("Migros", "Migros Kadıköy") == "Migros"
    assert _normalize_chain(None, "CarrefourSA") == "CarrefourSA"


def test_dedupe_markets():
    a = {"id": "1", "name": "A", "lat": 40.99, "lng": 29.03}
    b = {"id": "2", "name": "B", "lat": 40.9901, "lng": 29.0301}
    c = {"id": "3", "name": "C", "lat": 41.0, "lng": 29.1}
    result = _dedupe_markets([a, b, c])
    assert len(result) == 2


@pytest.mark.asyncio
async def test_nearby_markets_with_osm_mock():
    service = GeofenceService()
    osm_mock = [
        {"id": "osm-node-999", "name": "Test Market", "chain": "BİM",
         "lat": 40.9905, "lng": 29.0300, "source": "osm"},
    ]
    with patch("app.services.geofence.service.fetch_osm_markets", AsyncMock(return_value=osm_mock)):
        with patch("app.services.geofence.service.cache_get", AsyncMock(return_value=None)):
            with patch("app.services.geofence.service.cache_set", AsyncMock()):
                markets, source = await service.nearby_markets(40.9902, 29.0298, radius_km=2, use_osm=True)
    assert len(markets) >= 1
    assert source in ("osm+static", "static", "osm")


@pytest.mark.asyncio
async def test_nearby_markets_uses_cache():
    service = GeofenceService()
    cached = {"markets": [{"id": "cached-1", "name": "Cached", "lat": 40.99, "lng": 29.03, "distance_km": 0.1}], "source": "static"}
    with patch("app.services.geofence.service.cache_get", AsyncMock(return_value=cached)):
        markets, source = await service.nearby_markets(40.99, 29.03, radius_km=2)
    assert markets[0]["id"] == "cached-1"
    assert source == "static"
