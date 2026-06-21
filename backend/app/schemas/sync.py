from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SyncOperation(BaseModel):
    id: UUID
    type: Literal[
        "execute", "shopping_add", "shopping_complete", "shopping_delete", "shopping_routine",
        "wallet_income", "wallet_transfer", "wallet_expense", "micro_savings_transfer",
        "transaction_update", "transaction_delete",
        "wallet_create", "wallet_update", "wallet_delete",
        "agenda_add_bill", "agenda_add_task", "agenda_complete",
        "agenda_update", "agenda_delete", "agenda_mark_paid",
        "budget_create", "budget_update", "budget_delete",
    ]
    payload: dict[str, Any]
    client_timestamp: datetime
    resolve_strategy: Literal["local", "server"] | None = None


class SyncPushRequest(BaseModel):
    operations: list[SyncOperation] = Field(default_factory=list, max_length=50)


class SyncConflict(BaseModel):
    operation_id: UUID
    type: str
    field: str
    local: Any
    server: Any
    message: str


class SyncPushResponse(BaseModel):
    applied: list[dict[str, Any]]
    conflicts: list[SyncConflict]
    failed: list[dict[str, Any]]


class SyncPullResponse(BaseModel):
    shopping: list[dict[str, Any]]
    agenda: list[dict[str, Any]]
    agenda_history: list[dict[str, Any]] = Field(default_factory=list)
    wallets: list[dict[str, Any]]
    net_worth_total: float = 0
    budgets: list[dict[str, Any]] = Field(default_factory=list)
    transactions: list[dict[str, Any]]
    receipts: list[dict[str, Any]]
    server_timestamp: datetime
