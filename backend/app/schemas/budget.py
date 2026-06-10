from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class BudgetCreate(BaseModel):
    category: str
    monthly_limit: Decimal


class BudgetUpdate(BaseModel):
    monthly_limit: Decimal


class BudgetResponse(BaseModel):
    id: UUID
    category: str
    monthly_limit: Decimal
    currency: str
    created_at: datetime
