from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import t
from app.models.user import User
from app.services.podcast.service import PodcastService
from app.services.storage.service import StorageService

router = APIRouter(prefix="/podcast", tags=["Weekly Podcast"])
podcast_service = PodcastService()
storage_service = StorageService()


@router.get("/latest")
async def latest_podcast(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    podcast = await podcast_service.latest_for_user(db, user.id)
    if not podcast:
        return {"available": False}
    return {
        "available": True,
        "id": str(podcast.id),
        "script": podcast.script,
        "week_start": podcast.week_start.isoformat(),
        "has_audio": bool(podcast.audio_path),
        "audio_url": f"/podcast/{podcast.id}/audio" if podcast.audio_path else None,
        "created_at": podcast.created_at.isoformat() if podcast.created_at else None,
    }


@router.get("/{podcast_id}/audio")
async def podcast_audio(
    podcast_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.podcast import WeeklyPodcast

    lang = user_locale(user)
    podcast = await db.get(WeeklyPodcast, podcast_id)
    if not podcast or podcast.user_id != user.id or not podcast.audio_path:
        raise HTTPException(status_code=404, detail=t("podcast.not_found", lang))
    try:
        data, media_type = await storage_service.read_bytes(podcast.audio_path)
        return Response(content=data, media_type=media_type)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=t("podcast.not_found", lang))
