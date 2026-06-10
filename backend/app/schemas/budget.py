from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BudgetCreate(BaseModel):
    category: str
    monthly_limit: Decimal


class BudgetUpdate(BaseModel):
    monthly_limit: Decimal


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category: str
    monthly_limit: Decimal
    currency: str
    created_at: datetime
