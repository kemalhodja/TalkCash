from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.transaction import TransactionType
from app.schemas.common import ORMBase


class TransactionCreate(BaseModel):
    wallet_id: UUID
    amount: Decimal
    transaction_type: TransactionType = TransactionType.EXPENSE
    category: str = "Genel"
    description: str = ""
    place: str = ""
    input_method: str = "manual"


class TransactionResponse(ORMBase):
    id: UUID
    wallet_id: UUID
    transaction_type: TransactionType
    amount: Decimal
    currency: str
    category: str
    description: str
    place: str
    input_method: str
    created_at: datetime


class TransactionUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    category: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    place: str | None = Field(default=None, max_length=255)
