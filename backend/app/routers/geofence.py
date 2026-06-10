from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.user import User
from app.services.geofence.service import GeofenceService

router = APIRouter(prefix="/geofence", tags=["Geofence"])
geofence_service = GeofenceService()


@router.get("/markets")
async def nearby_markets(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(2.0, ge=0.5, le=15),
    user: User = Depends(get_current_user),
):
    markets = geofence_service.nearby_markets(lat, lng, radius_km)
    return {"markets": markets, "count": len(markets)}
