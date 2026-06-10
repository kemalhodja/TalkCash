from app.services.geofence.service import GeofenceService


def test_nearby_markets_istanbul():
    service = GeofenceService()
    markets = service.nearby_markets(40.9902, 29.0298, radius_km=2)
    assert len(markets) >= 1
    assert all("distance_km" in m for m in markets)
    assert markets[0]["distance_km"] <= 2


def test_nearby_markets_expands_radius():
    service = GeofenceService()
    markets = service.nearby_markets(41.0, 29.0, radius_km=2)
    assert len(markets) >= 1


def test_haversine_ordering():
    service = GeofenceService()
    markets = service.nearby_markets(40.9902, 29.0298, radius_km=5)
    distances = [m["distance_km"] for m in markets]
    assert distances == sorted(distances)
