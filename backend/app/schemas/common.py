from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_MONEY = Decimal("999999999.99")


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ConfirmAction(BaseModel):
    confirmed: bool


class ParsedInput(BaseModel):
    intent: str = Field(max_length=64)
    amount: Decimal | None = Field(default=None, gt=0, le=MAX_MONEY)
    currency: str = Field(default="TRY", max_length=10)
    category: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    place: str | None = Field(default=None, max_length=255)
    store_name: str | None = Field(default=None, max_length=255)
    date: datetime | None = None
    wallet_name: str | None = Field(default=None, max_length=100)
    target_wallet_name: str | None = Field(default=None, max_length=100)
    items: list[str] = Field(default_factory=list, max_length=50)
    person_name: str | None = Field(default=None, max_length=100)
    installment_count: int | None = Field(default=None, ge=1, le=360)
    person_count: int | None = Field(default=None, ge=2, le=100)
    receipt_id: str | None = Field(default=None, max_length=64)
    force: bool = False
    is_recurring: bool = False
    is_subscription: bool = False
    subscription_name: str | None = Field(default=None, max_length=255)
    raw_text: str = Field(default="", max_length=2000)
    confidence: float = Field(default=1.0, ge=0, le=1)
    parse_failed: bool = False

    @field_validator("items")
    @classmethod
    def trim_items(cls, value: list[str]) -> list[str]:
        return [item[:255] for item in value[:50]]


class ConfirmationCard(BaseModel):
    message: str
    parsed: ParsedInput
    requires_confirmation: bool = True
