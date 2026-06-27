from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, user_locale
from app.i18n import resolve_error
from app.models.user import User
from app.schemas.transaction import TransactionResponse
from app.schemas.wallet import NetWorthResponse, TransferRequest, WalletCreate, WalletResponse, WalletUpdate
from app.services.budget_notify import push_budget_alerts_after_expense
from app.services.wallet.service import WalletService

router = APIRouter(prefix="/wallets", tags=["Wallets"])
wallet_service = WalletService()


@router.get("/", response_model=list[WalletResponse])
async def list_wallets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await wallet_service.list_wallets(db, user.id)


@router.post("/", response_model=WalletResponse)
async def create_wallet(data: WalletCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await wallet_service.create_wallet(db, user.id, data)


@router.patch("/{wallet_id}", response_model=WalletResponse)
async def update_wallet(
    wallet_id: UUID, data: WalletUpdate,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        return await wallet_service.update_wallet(db, user.id, wallet_id, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))


@router.delete("/{wallet_id}")
async def deactivate_wallet(
    wallet_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        await wallet_service.deactivate_wallet(db, user.id, wallet_id)
        return {"status": "deactivated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))


@router.get("/net-worth", response_model=NetWorthResponse)
async def get_net_worth(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await wallet_service.get_net_worth(db, user.id)


@router.get("/monthly-summary")
async def get_monthly_summary(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await wallet_service.monthly_summary(db, user.id)


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
    store_name: str = "",
    receipt_id: UUID | None = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    lang = user_locale(user)
    resolved = (store_name or place or "Genel").strip()
    tx = await wallet_service.add_expense(
        db, user.id, wallet_id, Decimal(str(amount)), category, description,
        place or resolved, store_name=resolved,
        input_method="manual", receipt_id=receipt_id,
    )
    await push_budget_alerts_after_expense(db, user.id, category, lang)
    return TransactionResponse.model_validate(tx)


@router.post("/income", response_model=TransactionResponse)
async def add_income(
    wallet_id: UUID, amount: float, description: str = "",
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    try:
        tx = await wallet_service.add_income(
            db, user.id, wallet_id, Decimal(str(amount)), description, input_method="manual",
        )
        return TransactionResponse.model_validate(tx)
    except Exception as e:
        raise HTTPException(status_code=400, detail=resolve_error(e, user_locale(user)))
