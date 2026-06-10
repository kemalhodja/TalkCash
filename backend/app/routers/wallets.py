from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error
from app.models.user import User
from app.schemas.transaction import TransactionResponse
from app.schemas.wallet import NetWorthResponse, TransferRequest, WalletCreate, WalletResponse
from app.services.wallet.service import WalletService

router = APIRouter(prefix="/wallets", tags=["Wallets"])
wallet_service = WalletService()


@router.get("/", response_model=list[WalletResponse])
async def list_wallets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await wallet_service.list_wallets(db, user.id)


@router.post("/", response_model=WalletResponse)
async def create_wallet(data: WalletCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await wallet_service.create_wallet(db, user.id, data)


@router.get("/net-worth", response_model=NetWorthResponse)
async def get_net_worth(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await wallet_service.get_net_worth(db, user.id)


@router.post("/transfer")
async def transfer(data: TransferRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        from_w, to_w = await wallet_service.transfer(
            db, user.id, data.from_wallet_id, data.to_wallet_id, data.amount, data.description
        )
        return {"from_balance": float(from_w.balance), "to_balance": float(to_w.balance)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))


@router.post("/expense", response_model=TransactionResponse)
async def add_expense(
    wallet_id: UUID, amount: float,
    category: str = "Genel", description: str = "", place: str = "",
    receipt_id: UUID | None = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    tx = await wallet_service.add_expense(
        db, user.id, wallet_id, Decimal(str(amount)), category, description, place,
        receipt_id=receipt_id,
    )
    return TransactionResponse.model_validate(tx)
