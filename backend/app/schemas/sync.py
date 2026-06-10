from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SyncOperation(BaseModel):
    id: UUID
    type: Literal[
        "execute", "shopping_add", "shopping_complete",
        "wallet_income", "wallet_transfer", "wallet_expense",
    ]
    payload: dict[str, Any]
    client_timestamp: datetime
    resolve_strategy: Literal["local", "server"] | None = None


class SyncPushRequest(BaseModel):
    operations: list[SyncOperation] = Field(default_factory=list)


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
    wallets: list[dict[str, Any]]
    transactions: list[dict[str, Any]]
    receipts: list[dict[str, Any]]
    server_timestamp: datetime
