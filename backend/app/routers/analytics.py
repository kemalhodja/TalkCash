from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.analytics import ProductEvent
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class ProductEventRequest(BaseModel):
    event_name: str = Field(min_length=2, max_length=120)
    properties: dict | None = None


@router.post("/events")
async def track_event(
    data: ProductEventRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = ProductEvent(user_id=user.id, event_name=data.event_name, properties=data.properties or {})
    db.add(event)
    await db.commit()
    return {"tracked": True}
