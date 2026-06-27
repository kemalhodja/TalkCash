from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_entitlement, user_locale
from app.i18n import resolve_error
from app.models.user import User
from app.schemas.workspace import (
    AcceptInvitationRequest,
    InvitationInboxItem,
    InvitationResponse,
    WorkspaceCreate,
    WorkspaceInvite,
    WorkspaceResponse,
)
from app.services.workspace.service import workspace_invite_url
from app.services.workspace.service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])
workspace_service = WorkspaceService()


@router.get("/", response_model=list[WorkspaceResponse])
async def list_workspaces(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await workspace_service.list_workspaces(db, user.id)


@router.post("/", response_model=WorkspaceResponse)
async def create_workspace(
    data: WorkspaceCreate,
    _workspace: None = Depends(require_entitlement("shared_workspace")),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        org = await workspace_service.create_workspace(db, user.id, data)
        return WorkspaceResponse(
            id=org.id,
            name=org.name,
            workspace_type=org.workspace_type,
            role="owner",
            members_count=1,
        )
    except Exception as exc:
        raise HTTPException(status_code=402 if str(exc) == "premium_required" else 400, detail=resolve_error(exc, user_locale(user)))


@router.post("/{workspace_id}/invite", response_model=InvitationResponse)
async def invite_workspace_member(
    workspace_id: UUID,
    data: WorkspaceInvite,
    _workspace: None = Depends(require_entitlement("shared_workspace")),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        invite = await workspace_service.invite_member(db, user.id, workspace_id, data)
        return InvitationResponse(
            id=invite.id,
            email=invite.email,
            role=invite.role,
            status=invite.status,
            created_at=invite.created_at,
            accept_url=workspace_invite_url(invite.token),
        )
    except Exception as exc:
        raise HTTPException(status_code=403, detail=resolve_error(exc, user_locale(user)))


@router.get("/{workspace_id}/invitations", response_model=list[InvitationResponse])
async def list_workspace_invitations(
    workspace_id: UUID,
    _workspace: None = Depends(require_entitlement("shared_workspace")),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        invites = await workspace_service.list_invitations(db, user.id, workspace_id)
        return [
            InvitationResponse(
                id=i.id,
                email=i.email,
                role=i.role,
                status=i.status,
                created_at=i.created_at,
                accept_url=workspace_invite_url(i.token),
            )
            for i in invites
        ]
    except Exception as exc:
        raise HTTPException(status_code=403, detail=resolve_error(exc, user_locale(user)))


@router.delete("/{workspace_id}/invitations/{invitation_id}", status_code=204)
async def cancel_workspace_invitation(
    workspace_id: UUID,
    invitation_id: UUID,
    _workspace: None = Depends(require_entitlement("shared_workspace")),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await workspace_service.cancel_invitation(db, user.id, workspace_id, invitation_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=resolve_error(exc, user_locale(user)))


@router.get("/invitations/inbox", response_model=list[InvitationInboxItem])
async def list_invitation_inbox(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await workspace_service.list_inbox(db, user.id, user.email)
    return [InvitationInboxItem.model_validate(row) for row in rows]


@router.post("/invitations/accept", response_model=WorkspaceResponse)
async def accept_workspace_invitation(
    data: AcceptInvitationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        org = await workspace_service.accept_invitation(db, user.id, user.email, data.token)
        members = await workspace_service.list_workspaces(db, user.id)
        match = next((w for w in members if w.id == org.id), None)
        if match:
            return match
        return WorkspaceResponse(
            id=org.id,
            name=org.name,
            workspace_type=org.workspace_type,
            role="member",
            members_count=1,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=resolve_error(exc, user_locale(user)))
