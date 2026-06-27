import secrets
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workspace import Invitation, Organization, OrganizationMember, WorkspaceRole
from app.schemas.workspace import WorkspaceCreate, WorkspaceInvite, WorkspaceResponse
from app.services.audit.service import AuditService
from app.services.billing.service import BillingService


def workspace_invite_url(token: str) -> str:
    return f"talkcash://workspace-invite?token={token}"


class WorkspaceService:
    def __init__(self):
        self.audit = AuditService()
        self.billing = BillingService()

    async def list_workspaces(self, db: AsyncSession, user_id: UUID) -> list[WorkspaceResponse]:
        result = await db.execute(
            select(Organization, OrganizationMember.role, func.count(OrganizationMember.id).over(partition_by=Organization.id))
            .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
            .where(OrganizationMember.user_id == user_id)
            .order_by(Organization.created_at.desc())
        )
        return [
            WorkspaceResponse(
                id=org.id,
                name=org.name,
                workspace_type=org.workspace_type,
                role=role,
                members_count=members_count,
            )
            for org, role, members_count in result.all()
        ]

    async def create_workspace(self, db: AsyncSession, user_id: UUID, data: WorkspaceCreate) -> Organization:
        status = await self.billing.get_status(db, user_id)
        entitlement = status.entitlements.get("shared_workspace")
        existing = await self.list_workspaces(db, user_id)
        if not entitlement or not entitlement.enabled or (
            entitlement.limit is not None and len(existing) >= entitlement.limit
        ):
            raise ValueError("premium_required")

        org = Organization(owner_id=user_id, name=data.name.strip(), workspace_type=data.workspace_type)
        db.add(org)
        await db.flush()
        db.add(OrganizationMember(organization_id=org.id, user_id=user_id, role=WorkspaceRole.OWNER))
        await self.audit.log(
            db,
            actor_user_id=user_id,
            action="workspace.created",
            resource_type="organization",
            resource_id=str(org.id),
            metadata={"workspace_type": data.workspace_type.value},
        )
        await db.commit()
        await db.refresh(org)
        return org

    async def invite_member(self, db: AsyncSession, user_id: UUID, org_id: UUID, data: WorkspaceInvite) -> Invitation:
        member = await self._require_admin(db, user_id, org_id)
        token = secrets.token_urlsafe(32)
        invitation = Invitation(
            organization_id=member.organization_id,
            email=str(data.email).strip().lower(),
            role=data.role,
            token=token,
        )
        db.add(invitation)
        await self.audit.log(
            db,
            actor_user_id=user_id,
            action="workspace.invite_created",
            resource_type="organization",
            resource_id=str(org_id),
            metadata={"email": invitation.email, "role": data.role.value},
        )
        await db.commit()
        await db.refresh(invitation)
        return invitation

    async def list_inbox(self, db: AsyncSession, user_id: UUID, email: str) -> list[dict]:
        normalized = email.strip().lower()
        result = await db.execute(
            select(Invitation, Organization.name)
            .join(Organization, Organization.id == Invitation.organization_id)
            .where(Invitation.email == normalized, Invitation.status == "pending")
            .order_by(Invitation.created_at.desc())
        )
        rows = []
        for invitation, org_name in result.all():
            member_check = await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == invitation.organization_id,
                    OrganizationMember.user_id == user_id,
                )
            )
            if member_check.scalars().first():
                continue
            rows.append({
                "id": invitation.id,
                "organization_id": invitation.organization_id,
                "organization_name": org_name,
                "role": invitation.role,
                "token": invitation.token,
                "accept_url": workspace_invite_url(invitation.token),
                "created_at": invitation.created_at,
            })
        return rows

    async def accept_invitation(self, db: AsyncSession, user_id: UUID, email: str, token: str) -> Organization:
        normalized = email.strip().lower()
        result = await db.execute(
            select(Invitation, Organization)
            .join(Organization, Organization.id == Invitation.organization_id)
            .where(Invitation.token == token, Invitation.status == "pending")
        )
        row = result.first()
        if not row:
            raise ValueError("invitation.not_found")
        invitation, org = row
        if invitation.email != normalized:
            raise ValueError("invitation.email_mismatch")

        existing = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == user_id,
            )
        )
        if existing.scalars().first():
            invitation.status = "accepted"
            await db.commit()
            return org

        db.add(OrganizationMember(organization_id=org.id, user_id=user_id, role=invitation.role))
        invitation.status = "accepted"
        await self.audit.log(
            db,
            actor_user_id=user_id,
            action="workspace.invite_accepted",
            resource_type="organization",
            resource_id=str(org.id),
            metadata={"email": normalized, "role": invitation.role.value},
        )
        await db.commit()
        await db.refresh(org)
        return org

    async def list_invitations(self, db: AsyncSession, user_id: UUID, org_id: UUID) -> list[Invitation]:
        await self._require_admin(db, user_id, org_id)
        result = await db.execute(
            select(Invitation)
            .where(Invitation.organization_id == org_id, Invitation.status == "pending")
            .order_by(Invitation.created_at.desc())
        )
        return list(result.scalars().all())

    async def cancel_invitation(self, db: AsyncSession, user_id: UUID, org_id: UUID, invitation_id: UUID) -> None:
        await self._require_admin(db, user_id, org_id)
        result = await db.execute(
            select(Invitation).where(
                Invitation.id == invitation_id,
                Invitation.organization_id == org_id,
                Invitation.status == "pending",
            )
        )
        invitation = result.scalars().first()
        if not invitation:
            raise ValueError("invitation.not_found")
        invitation.status = "cancelled"
        await db.commit()

    async def _require_admin(self, db: AsyncSession, user_id: UUID, org_id: UUID) -> OrganizationMember:
        result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user_id,
            )
        )
        member = result.scalars().first()
        if not member or member.role not in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN):
            raise ValueError("workspace.forbidden")
        return member
