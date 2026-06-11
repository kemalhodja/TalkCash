from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError
from app.models.transaction import Transaction, TransactionType
from app.models.wallet import Wallet, WalletType
from app.schemas.wallet import NetWorthResponse, WalletCreate, WalletResponse
from app.services.exchange.service import ExchangeService


DEFAULT_WALLETS = [
    ("Nakit", WalletType.CASH),
    ("Banka", WalletType.BANK),
    ("Kredi Kartı", WalletType.CREDIT_CARD),
    ("Altın", WalletType.INVESTMENT_GOLD),
    ("Döviz", WalletType.INVESTMENT_FOREX),
]

WALLET_ALIASES: dict[str, str] = {
    "cash": "Nakit",
    "nakit": "Nakit",
    "bank": "Banka",
    "banka": "Banka",
    "credit card": "Kredi Kartı",
    "credit": "Kredi Kartı",
    "card": "Kredi Kartı",
    "gold": "Altın",
    "forex": "Döviz",
    "döviz": "Döviz",
    "doviz": "Döviz",
}


def _is_credit_card(wallet: Wallet) -> bool:
    return wallet.wallet_type == WalletType.CREDIT_CARD


def _apply_outflow(wallet: Wallet, amount: Decimal) -> None:
    """Expense or transfer out: credit card balance rises (more debt)."""
    if _is_credit_card(wallet):
        wallet.balance += amount
    else:
        wallet.balance -= amount


def _ensure_can_spend(wallet: Wallet, amount: Decimal) -> None:
    if _is_credit_card(wallet):
        return
    if wallet.balance < amount:
        raise I18nError("wallet.insufficient_funds")


def _apply_inflow(wallet: Wallet, amount: Decimal) -> None:
    """Income or transfer in: credit card payment reduces debt."""
    if _is_credit_card(wallet):
        wallet.balance = max(Decimal("0"), wallet.balance - amount)
    else:
        wallet.balance += amount


class WalletService:
    def __init__(self):
        self.exchange = ExchangeService()

    async def create_defaults(self, db: AsyncSession, user_id: UUID, *, commit: bool = True) -> list[Wallet]:
        wallets = []
        for name, wtype in DEFAULT_WALLETS:
            wallet = Wallet(user_id=user_id, name=name, wallet_type=wtype)
            db.add(wallet)
            wallets.append(wallet)
        if commit:
            await db.commit()
        else:
            await db.flush()
        return wallets

    async def list_wallets(self, db: AsyncSession, user_id: UUID) -> list[WalletResponse]:
        result = await db.execute(select(Wallet).where(Wallet.user_id == user_id, Wallet.is_active == True))
        return [WalletResponse.model_validate(w) for w in result.scalars().all()]

    async def create_wallet(self, db: AsyncSession, user_id: UUID, data: WalletCreate) -> WalletResponse:
        wallet = Wallet(user_id=user_id, **data.model_dump())
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
        return WalletResponse.model_validate(wallet)

    async def get_net_worth(self, db: AsyncSession, user_id: UUID) -> NetWorthResponse:
        result = await db.execute(select(Wallet).where(Wallet.user_id == user_id, Wallet.is_active == True))
        raw_wallets = list(result.scalars().all())
        total = Decimal("0")
        wallet_responses = []
        for w in raw_wallets:
            try_value = await self.exchange.convert_to_try(db, w.balance, w.currency, w.wallet_type.value)
            if _is_credit_card(w):
                total -= try_value
            else:
                total += try_value
            resp = WalletResponse.model_validate(w)
            wallet_responses.append(resp)
        return NetWorthResponse(total_try=total, wallets=wallet_responses)

    async def transfer(
        self, db: AsyncSession, user_id: UUID, from_id: UUID, to_id: UUID, amount: Decimal, description: str = ""
    ) -> tuple[Wallet, Wallet]:
        from_wallet = await db.get(Wallet, from_id)
        to_wallet = await db.get(Wallet, to_id)
        if not from_wallet or not to_wallet:
            raise I18nError("wallet.not_found")

        _ensure_can_spend(from_wallet, amount)
        _apply_outflow(from_wallet, amount)
        _apply_inflow(to_wallet, amount)

        db.add(Transaction(
            user_id=user_id, wallet_id=from_id, target_wallet_id=to_id,
            transaction_type=TransactionType.TRANSFER, amount=amount,
            description=description, input_method="voice",
        ))
        await db.commit()
        return from_wallet, to_wallet

    async def add_income(
        self, db: AsyncSession, user_id: UUID, wallet_id: UUID,
        amount: Decimal, description: str = "", input_method: str = "voice",
    ) -> Transaction:
        wallet = await db.get(Wallet, wallet_id)
        if not wallet:
            raise I18nError("wallet.not_found")
        _apply_inflow(wallet, amount)
        tx = Transaction(
            user_id=user_id, wallet_id=wallet_id,
            transaction_type=TransactionType.INCOME, amount=amount,
            description=description, input_method=input_method,
        )
        db.add(tx)
        await db.commit()
        await db.refresh(tx)
        return tx

    async def add_expense(
        self, db: AsyncSession, user_id: UUID, wallet_id: UUID,
        amount: Decimal, category: str, description: str = "", place: str = "",
        input_method: str = "voice", receipt_id: UUID | None = None,
    ) -> Transaction:
        wallet = await db.get(Wallet, wallet_id)
        if not wallet:
            raise I18nError("wallet.not_found")
        _ensure_can_spend(wallet, amount)
        _apply_outflow(wallet, amount)
        tx = Transaction(
            user_id=user_id, wallet_id=wallet_id,
            transaction_type=TransactionType.EXPENSE, amount=amount,
            category=category, description=description, place=place, input_method=input_method,
            receipt_id=receipt_id,
        )
        db.add(tx)
        await db.commit()
        await db.refresh(tx)
        return tx

    async def find_by_name(self, db: AsyncSession, user_id: UUID, name: str) -> Wallet | None:
        key = name.lower().strip()
        resolved = WALLET_ALIASES.get(key, name)
        result = await db.execute(
            select(Wallet).where(Wallet.user_id == user_id, Wallet.name.ilike(f"%{resolved}%"))
        )
        wallet = result.scalars().first()
        if wallet or resolved == name:
            return wallet
        result = await db.execute(
            select(Wallet).where(Wallet.user_id == user_id, Wallet.name.ilike(f"%{name}%"))
        )
        return result.scalars().first()
