from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ConfirmAction(BaseModel):
    confirmed: bool


class ParsedInput(BaseModel):
    intent: str
    amount: Decimal | None = None
    currency: str = "TRY"
    category: str | None = None
    description: str | None = None
    place: str | None = None
    date: datetime | None = None
    wallet_name: str | None = None
    target_wallet_name: str | None = None
    items: list[str] = []
    person_name: str | None = None
    installment_count: int | None = None
    raw_text: str = ""
    confidence: float = 1.0


class ConfirmationCard(BaseModel):
    message: str
    parsed: ParsedInput
    requires_confirmation: bool = True
