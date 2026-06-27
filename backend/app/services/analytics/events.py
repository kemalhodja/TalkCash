"""Lightweight product-event helpers for retention and funnel triggers."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import ProductEvent


async def track_product_event(
    db: AsyncSession,
    user_id: UUID,
    event_name: str,
    properties: dict | None = None,
) -> None:
    db.add(ProductEvent(user_id=user_id, event_name=event_name, properties=properties or {}))
    await db.commit()


async def track_entitlement_limit_hit(db: AsyncSession, user_id: UUID, entitlement: str) -> None:
    await track_product_event(
        db,
        user_id,
        "entitlement_limit_hit",
        {"entitlement": entitlement},
    )
