from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.transaction import TransactionResponse
from app.schemas.wallet import NetWorthResponse, TransferRequest, WalletCreate, WalletResponse
from app.services.wallet.service import WalletService

router = APIRouter(prefix="/wallets", tags=["Wallets"])
wallet_service = WalletService()


@router.get("/", response_model=list[WalletResponse])
async def list_wallets(user_id: UUID, db: AsyncSession = Depends(get_db)):
    return await wallet_service.list_wallets(db, user_id)


@router.post("/", response_model=WalletResponse)
async def create_wallet(user_id: UUID, data: WalletCreate, db: AsyncSession = Depends(get_db)):
    return await wallet_service.create_wallet(db, user_id, data)


@router.get("/net-worth", response_model=NetWorthResponse)
async def get_net_worth(user_id: UUID, db: AsyncSession = Depends(get_db)):
    return await wallet_service.get_net_worth(db, user_id)


@router.post("/transfer")
async def transfer(user_id: UUID, data: TransferRequest, db: AsyncSession = Depends(get_db)):
    try:
        from_w, to_w = await wallet_service.transfer(
            db, user_id, data.from_wallet_id, data.to_wallet_id, data.amount, data.description
        )
        return {"from_balance": from_w.balance, "to_balance": to_w.balance}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/expense", response_model=TransactionResponse)
async def add_expense(
    user_id: UUID, wallet_id: UUID, amount: float,
    category: str = "Genel", description: str = "", place: str = "",
    db: AsyncSession = Depends(get_db),
):
    from decimal import Decimal
    tx = await wallet_service.add_expense(
        db, user_id, wallet_id, Decimal(str(amount)), category, description, place
    )
    return TransactionResponse.model_validate(tx)
