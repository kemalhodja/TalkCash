from datetime import datetime
from decimal import Decimal
from uuid import UUID

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
