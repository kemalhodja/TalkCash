from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.workspace import WorkspaceRole, WorkspaceType


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    workspace_type: WorkspaceType = WorkspaceType.FAMILY


class WorkspaceInvite(BaseModel):
    email: EmailStr
    role: WorkspaceRole = WorkspaceRole.MEMBER


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    workspace_type: WorkspaceType
    role: WorkspaceRole
    members_count: int


class InvitationResponse(BaseModel):
    id: UUID
    email: str
    role: WorkspaceRole
    status: str
    created_at: datetime | None = None
