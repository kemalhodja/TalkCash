from uuid import UUID

from pydantic import BaseModel, Field


class MicroSavingsTransferRequest(BaseModel):
    from_wallet_id: UUID
    to_wallet_id: UUID
    amount: float = Field(gt=0)
    rule_key: str = Field(min_length=1, max_length=40)


class MicroSavingsPrefsUpdate(BaseModel):
    round_up_enabled: bool | None = None
    round_up_step: int | None = None
    auto_round_up: bool | None = None
    preferred_broker: str | None = None
    default_investment_wallet: str | None = None


class MicroSavingsSimulateRequest(BaseModel):
    monthly_contribution: float = Field(default=0, ge=0, le=1_000_000)
    months: int = Field(default=12, ge=1, le=60)
    starting_balance: float = Field(default=0, ge=0)
    annual_return: float = Field(default=0.08, ge=0, le=1)
