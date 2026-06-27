from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.analytics import ProductEvent
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])

FUNNEL_EVENTS = (
    "register_success",
    "onboarding_completed",
    "first_expense",
    "first_sync",
    "paywall_viewed",
    "premium_upgrade_tapped",
)


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


@router.get("/funnel")
async def funnel_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Per-user funnel progress for debugging and support."""
    result = await db.execute(
        select(ProductEvent.event_name, func.count())
        .where(ProductEvent.user_id == user.id, ProductEvent.event_name.in_(FUNNEL_EVENTS))
        .group_by(ProductEvent.event_name)
    )
    counts = {row[0]: row[1] for row in result.all()}
    return {
        "events": {name: counts.get(name, 0) for name in FUNNEL_EVENTS},
        "completed_steps": sum(1 for name in FUNNEL_EVENTS if counts.get(name, 0) > 0),
        "total_steps": len(FUNNEL_EVENTS),
    }
