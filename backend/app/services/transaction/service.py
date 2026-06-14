from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError
from app.models.transaction import Transaction, TransactionType
from app.models.wallet import Wallet
from app.schemas.transaction import TransactionUpdate
from app.services.wallet.service import WalletService, _apply_inflow, _apply_outflow, _ensure_can_spend, _is_credit_card


class TransactionService:
    def __init__(self):
        self.wallet_service = WalletService()

    async def get_owned(self, db: AsyncSession, user_id: UUID, tx_id: UUID) -> Transaction:
        tx = await db.get(Transaction, tx_id)
        if not tx or tx.user_id != user_id:
            raise I18nError("transaction.not_found")
        return tx

    def _reverse_effect(self, tx: Transaction, wallet: Wallet, target: Wallet | None) -> None:
        if tx.transaction_type == TransactionType.EXPENSE:
            _apply_inflow(wallet, tx.amount)
        elif tx.transaction_type == TransactionType.INCOME:
            _apply_outflow(wallet, tx.amount)
        elif tx.transaction_type == TransactionType.TRANSFER and target:
            _apply_inflow(wallet, tx.amount)
            _apply_outflow(target, tx.amount)

    def _apply_effect(self, tx: Transaction, wallet: Wallet, target: Wallet | None) -> None:
        if tx.transaction_type == TransactionType.EXPENSE:
            _ensure_can_spend(wallet, tx.amount)
            _apply_outflow(wallet, tx.amount)
        elif tx.transaction_type == TransactionType.INCOME:
            _apply_inflow(wallet, tx.amount)
        elif tx.transaction_type == TransactionType.TRANSFER and target:
            _ensure_can_spend(wallet, tx.amount)
            _apply_outflow(wallet, tx.amount)
            _apply_inflow(target, tx.amount)

    async def update(
        self, db: AsyncSession, user_id: UUID, tx_id: UUID, data: TransactionUpdate,
    ) -> Transaction:
        tx = await self.get_owned(db, user_id, tx_id)
        if tx.transaction_type == TransactionType.TRANSFER:
            raise I18nError("transaction.transfer_edit_unsupported")

        wallet = await db.get(Wallet, tx.wallet_id)
        if not wallet:
            raise I18nError("wallet.not_found")

        self._reverse_effect(tx, wallet, None)

        if data.amount is not None:
            tx.amount = data.amount
        if data.category is not None:
            tx.category = data.category
        if data.description is not None:
            tx.description = data.description
        if data.place is not None:
            tx.place = data.place

        self._apply_effect(tx, wallet, None)
        await db.commit()
        await db.refresh(tx)
        return tx

    async def delete(self, db: AsyncSession, user_id: UUID, tx_id: UUID) -> None:
        tx = await self.get_owned(db, user_id, tx_id)
        wallet = await db.get(Wallet, tx.wallet_id)
        if not wallet:
            raise I18nError("wallet.not_found")

        target = None
        if tx.transaction_type == TransactionType.TRANSFER:
            target = await db.get(Wallet, tx.target_wallet_id) if tx.target_wallet_id else None
            if not target:
                raise I18nError("wallet.not_found")

        self._reverse_effect(tx, wallet, target)
        await db.delete(tx)
        await db.commit()
