from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


class AuditService:
    async def log(
        self,
        db: AsyncSession,
        *,
        actor_user_id: UUID | None,
        action: str,
        resource_type: str = "",
        resource_id: str | None = None,
        metadata: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        commit: bool = False,
    ) -> AuditLog:
        entry = AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_json=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(entry)
        if commit:
            await db.commit()
            await db.refresh(entry)
        else:
            await db.flush()
        return entry
