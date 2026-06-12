from fastapi import APIRouter, Depends, Query, Request

from app.config import settings
from app.dependencies import get_current_user
from app.models.user import User
from app.services.geofence.service import GeofenceService
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/geofence", tags=["Geofence"])
geofence_service = GeofenceService()


@router.get("/markets")
async def nearby_markets(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(2.0, ge=0.5, le=15),
    use_osm: bool = Query(True, description="Merge OpenStreetMap Overpass results"),
    user: User = Depends(get_current_user),
):
    await check_rate_limit(request, "geofence", settings.geofence_rate_limit, identifier=str(user.id), strict=True)
    markets, source = await geofence_service.nearby_markets(lat, lng, radius_km, use_osm=use_osm)
    return {"markets": markets, "count": len(markets), "source": source}
