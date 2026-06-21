from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import I18nError, resolve_error
from app.models.user import User
from app.schemas.roadmap import RoadmapGroupedResponse, RoadmapVoteResponse
from app.services.roadmap.service import RoadmapService

router = APIRouter(prefix="/roadmap", tags=["Roadmap"])
service = RoadmapService()


@router.get("", response_model=RoadmapGroupedResponse)
async def list_roadmap(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_grouped(db, user.id, user_locale(user))


@router.post("/{feature_id}/vote", response_model=RoadmapVoteResponse)
async def vote_feature(
    feature_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        feature = await service.vote(db, user.id, feature_id)
        return RoadmapVoteResponse(feature_id=feature.id, vote_count=feature.vote_count, is_voted=True)
    except I18nError as e:
        if e.key == "roadmap.feature_not_found":
            status = 404
        else:
            status = 400
        raise HTTPException(status_code=status, detail=resolve_error(e, user_locale(user)))
