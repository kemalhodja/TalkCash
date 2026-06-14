import json
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.i18n import I18nError
from app.models.agenda import AgendaItem
from app.models.budget import BudgetLimit
from app.models.notification import Notification
from app.models.receipt import Receipt
from app.models.chat_message import ChatMessage
from app.models.refresh_token import RefreshToken
from app.models.shopping import ShoppingItem
from app.models.social import DebtRecord, PriceWatchItem, SharedWallet, SharedWalletEntry, SplitBill
from app.models.sync_operation import SyncOperationRecord
from app.models.transaction import Transaction
from app.models.user import User
from app.models.wallet import Wallet
from app.services.wallet.service import WalletService
from app.utils.security import (
    create_access_token,
    create_refresh_token_value,
    hash_password,
    hash_refresh_token,
    verify_password,
)


class AuthService:
    def __init__(self):
        self.wallet_service = WalletService()

    async def _issue_tokens(self, db: AsyncSession, user: User) -> tuple[str, str]:
        access = create_access_token(user.id)
        raw_refresh = create_refresh_token_value()
        db.add(RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days),
        ))
        await db.commit()
        return access, raw_refresh

    async def register(self, db: AsyncSession, email: str, password: str, full_name: str = "") -> tuple[User, str, str]:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalars().first():
            raise I18nError("auth.email_exists")

        user = User(email=email, hashed_password=hash_password(password), full_name=full_name)
        db.add(user)
        await db.flush()
        await self.wallet_service.create_defaults(db, user.id, commit=False)
        access, refresh = await self._issue_tokens(db, user)
        await db.refresh(user)
        return user, access, refresh

    async def login(self, db: AsyncSession, email: str, password: str) -> tuple[User, str, str]:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if not user or not verify_password(password, user.hashed_password):
            raise I18nError("auth.invalid_credentials")
        access, refresh = await self._issue_tokens(db, user)
        return user, access, refresh

    async def refresh(self, db: AsyncSession, refresh_token: str) -> tuple[User, str, str]:
        token_hash = hash_refresh_token(refresh_token)
        result = await db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.utcnow(),
            )
        )
        record = result.scalars().first()
        if not record:
            raise I18nError("auth.invalid_refresh")

        user = await db.get(User, record.user_id)
        if not user:
            raise I18nError("auth.user_not_found")

        record.revoked_at = datetime.utcnow()
        access, new_refresh = await self._issue_tokens(db, user)
        return user, access, new_refresh

    async def revoke_refresh_token(self, db: AsyncSession, refresh_token: str) -> None:
        token_hash = hash_refresh_token(refresh_token)
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.utcnow())
        )
        await db.commit()

    async def set_pin(self, db: AsyncSession, user_id: UUID, pin: str) -> None:
        user = await db.get(User, user_id)
        if not user:
            raise I18nError("auth.user_not_found")
        user.pin_code = hash_password(pin)
        await db.commit()

    async def change_pin(self, db: AsyncSession, user_id: UUID, current_pin: str, new_pin: str) -> None:
        if not await self.verify_pin(db, user_id, current_pin):
            raise I18nError("auth.pin_invalid")
        await self.set_pin(db, user_id, new_pin)

    async def verify_pin(self, db: AsyncSession, user_id: UUID, pin: str) -> bool:
        user = await db.get(User, user_id)
        if not user or not user.pin_code:
            return False
        return verify_password(pin, user.pin_code)

    async def change_password(self, db: AsyncSession, user_id: UUID, current: str, new: str) -> None:
        user = await db.get(User, user_id)
        if not user or not verify_password(current, user.hashed_password):
            raise I18nError("auth.invalid_credentials")
        user.hashed_password = hash_password(new)
        await db.execute(
            update(RefreshToken).where(RefreshToken.user_id == user_id).values(revoked_at=datetime.utcnow())
        )
        await db.commit()

    async def delete_account(self, db: AsyncSession, user_id: UUID, password: str) -> None:
        user = await db.get(User, user_id)
        if not user or not verify_password(password, user.hashed_password):
            raise I18nError("auth.invalid_credentials")

        receipts = await db.execute(select(Receipt).where(Receipt.user_id == user_id))
        for receipt in receipts.scalars().all():
            if receipt.image_url and not receipt.image_url.startswith("http"):
                try:
                    from pathlib import Path
                    path = Path(receipt.image_url)
                    if path.exists():
                        path.unlink()
                except Exception:
                    pass

        shared = await db.execute(select(SharedWallet).where(SharedWallet.owner_id == user_id))
        for sw in shared.scalars().all():
            await db.execute(delete(SharedWalletEntry).where(SharedWalletEntry.wallet_id == sw.id))
            await db.delete(sw)

        member_wallets = await db.execute(select(SharedWallet))
        for sw in member_wallets.scalars().all():
            try:
                members = json.loads(sw.member_ids or "[]")
            except json.JSONDecodeError:
                members = []
            if str(user_id) in members:
                members = [m for m in members if m != str(user_id)]
                sw.member_ids = json.dumps(members)

        for model in (
            SyncOperationRecord, Notification, PriceWatchItem, SharedWalletEntry,
            DebtRecord, SplitBill, ShoppingItem, AgendaItem, BudgetLimit,
            Transaction, Receipt, Wallet, RefreshToken, ChatMessage,
        ):
            await db.execute(delete(model).where(model.user_id == user_id))

        await db.delete(user)
        await db.commit()

    async def toggle_biometric(self, db: AsyncSession, user_id: UUID, enabled: bool) -> None:
        user = await db.get(User, user_id)
        if not user:
            raise I18nError("auth.user_not_found")
        user.biometric_enabled = enabled
        await db.commit()

    async def set_locale(self, db: AsyncSession, user_id: UUID, locale: str) -> None:
        user = await db.get(User, user_id)
        if not user:
            raise I18nError("auth.user_not_found")
        user.locale = locale
        await db.commit()

    async def set_timezone(self, db: AsyncSession, user_id: UUID, timezone: str) -> None:
        user = await db.get(User, user_id)
        if not user:
            raise I18nError("auth.user_not_found")
        user.timezone = timezone
        await db.commit()

    async def set_push_token(self, db: AsyncSession, user_id: UUID, token: str) -> None:
        user = await db.get(User, user_id)
        if not user:
            raise I18nError("auth.user_not_found")
        user.push_token = token
        await db.commit()
