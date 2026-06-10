from pydantic import BaseModel

from app.schemas.common import ConfirmAction, ParsedInput


class ExecuteRequest(BaseModel):
    parsed: ParsedInput
    action: ConfirmAction
