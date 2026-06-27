from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.feedback import UserFeedback
from app.models.user import User

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackRequest(BaseModel):
    message: str = Field(min_length=3, max_length=4000)
    rating: int | None = Field(default=None, ge=1, le=5)
    app_version: str | None = Field(default=None, max_length=32)
    platform: str | None = Field(default=None, max_length=16)


@router.post("/")
async def submit_feedback(
    data: FeedbackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = UserFeedback(
        user_id=user.id,
        message=data.message.strip(),
        rating=data.rating,
        app_version=data.app_version,
        platform=data.platform,
    )
    db.add(row)
    await db.commit()
    return {"status": "ok", "id": str(row.id)}
