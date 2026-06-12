from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.models.wallet import WalletType
from app.schemas.common import ORMBase


class WalletCreate(BaseModel):
    name: str
    wallet_type: WalletType = WalletType.CASH
    balance: Decimal = Decimal("0")
    currency: str = "TRY"


class WalletUpdate(BaseModel):
    name: str | None = None
    wallet_type: WalletType | None = None
    currency: str | None = None


class WalletResponse(ORMBase):
    id: UUID
    name: str
    wallet_type: WalletType
    balance: Decimal
    currency: str
    is_active: bool
    created_at: datetime


class TransferRequest(BaseModel):
    from_wallet_id: UUID
    to_wallet_id: UUID
    amount: Decimal
    description: str = ""


class WalletNetWorthItem(WalletResponse):
    balance_try: Decimal


class NetWorthResponse(BaseModel):
    total_try: Decimal
    wallets: list[WalletNetWorthItem]
