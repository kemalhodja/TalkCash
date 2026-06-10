from unittest.mock import AsyncMock, patch

import pytest

from app.services.geofence.overpass import fetch_osm_markets, _parse_element


@pytest.mark.asyncio
async def test_fetch_osm_markets_disabled():
    with patch("app.services.geofence.overpass.settings") as mock_settings:
        mock_settings.overpass_enabled = False
        result = await fetch_osm_markets(40.99, 29.03)
    assert result == []


@pytest.mark.asyncio
async def test_fetch_osm_markets_parses_response():
    mock_response = {
        "elements": [
            {
                "type": "node", "id": 42,
                "lat": 40.991, "lon": 29.031,
                "tags": {"name": "Migros", "brand": "Migros", "shop": "supermarket"},
            },
            {
                "type": "way", "id": 99,
                "center": {"lat": 40.985, "lon": 29.025},
                "tags": {"name": "A101", "brand": "A101", "shop": "convenience"},
            },
        ],
    }
    with patch("app.services.geofence.overpass.settings") as mock_settings:
        mock_settings.overpass_enabled = True
        mock_settings.overpass_url = "https://overpass-api.de/api/interpreter"
        with patch("httpx.AsyncClient") as mock_client:
            instance = AsyncMock()
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=None)
            resp = AsyncMock()
            resp.raise_for_status = lambda: None
            resp.json = lambda: mock_response
            instance.post = AsyncMock(return_value=resp)
            mock_client.return_value = instance
            result = await fetch_osm_markets(40.99, 29.03, radius_km=2)

    assert len(result) == 2
    assert result[0]["source"] == "osm"
    assert result[0]["chain"] == "Migros"


def test_parse_way_element():
    el = {
        "type": "way", "id": 100,
        "center": {"lat": 41.0, "lon": 29.0},
        "tags": {"brand": "BİM", "shop": "supermarket"},
    }
    parsed = _parse_element(el)
    assert parsed["id"] == "osm-way-100"
    assert parsed["chain"] == "BİM"
