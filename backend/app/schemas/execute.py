from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import ConfirmAction, ParsedInput


class ExecuteRequest(BaseModel):
    user_id: UUID
    parsed: ParsedInput
    action: ConfirmAction
