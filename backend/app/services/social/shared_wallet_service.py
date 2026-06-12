import json
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError
from app.models.social import SharedWallet, SharedWalletEntry
from app.models.user import User
from app.utils.validation import parse_positive_amount, clamp_text


class SharedWalletManager:
    """In-memory WebSocket connection manager for shared wallets."""

    def __init__(self):
        self.connections: dict[str, list] = {}

    async def connect(self, wallet_id: str, websocket):
        self.connections.setdefault(wallet_id, []).append(websocket)

    def disconnect(self, wallet_id: str, websocket):
        if wallet_id in self.connections:
            self.connections[wallet_id] = [ws for ws in self.connections[wallet_id] if ws != websocket]

    async def broadcast(self, wallet_id: str, message: dict):
        for ws in self.connections.get(wallet_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass


wallet_manager = SharedWalletManager()


class SharedWalletService:
    async def create(self, db: AsyncSession, owner_id: UUID, name: str, member_ids: list[UUID] | None = None) -> SharedWallet:
        members = [str(owner_id)] + [str(m) for m in (member_ids or [])]
        wallet = SharedWallet(name=name, owner_id=owner_id, member_ids=json.dumps(members))
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
        return wallet

    async def get(self, db: AsyncSession, wallet_id: UUID) -> SharedWallet | None:
        return await db.get(SharedWallet, wallet_id)

    async def list_for_user(self, db: AsyncSession, user_id: UUID) -> list[SharedWallet]:
        uid = str(user_id)
        result = await db.execute(
            select(SharedWallet).where(
                (SharedWallet.owner_id == user_id) | SharedWallet.member_ids.contains(f'"{uid}"')
            )
        )
        return list(result.scalars().all())

    async def is_member(self, db: AsyncSession, wallet_id: UUID, user_id: UUID) -> bool:
        wallet = await self.get(db, wallet_id)
        if not wallet:
            return False
        members = json.loads(wallet.member_ids or "[]")
        return str(user_id) in members

    async def add_expense(
        self, db: AsyncSession, wallet_id: UUID, amount: Decimal,
        description: str, user_name: str, user_id: UUID | None = None,
    ) -> SharedWallet:
        wallet = await db.get(SharedWallet, wallet_id)
        if not wallet:
            raise I18nError("social.wallet_not_found")
        if user_id and not await self.is_member(db, wallet_id, user_id):
            raise I18nError("social.wallet_not_member")
        amount = parse_positive_amount(amount)
        description = clamp_text(description, max_len=255)
        user_name = clamp_text(user_name, max_len=100)
        wallet.balance -= amount
        if user_id:
            db.add(SharedWalletEntry(
                wallet_id=wallet_id, user_id=user_id, amount=amount,
                entry_type="expense", description=description,
            ))
        await db.commit()
        member_spent = await self._member_spent_totals(db, wallet_id)
        msg = {
            "type": "expense",
            "amount": float(amount),
            "description": description,
            "by": user_name,
            "by_user_id": str(user_id) if user_id else None,
            "balance": float(wallet.balance),
            "member_spent": member_spent,
        }
        from app.utils.redis_client import publish
        await publish(f"shared_wallet:{wallet_id}", msg)
        return wallet

    async def add_contribution(
        self, db: AsyncSession, wallet_id: UUID, user_id: UUID,
        amount: Decimal, description: str = "",
    ) -> SharedWallet:
        if not await self.is_member(db, wallet_id, user_id):
            raise I18nError("social.wallet_not_member")
        wallet = await db.get(SharedWallet, wallet_id)
        if not wallet:
            raise I18nError("social.wallet_not_found")
        amount = parse_positive_amount(amount)
        description = clamp_text(description, max_len=255)
        wallet.balance += amount
        db.add(SharedWalletEntry(
            wallet_id=wallet_id, user_id=user_id, amount=amount,
            entry_type="contribution", description=description,
        ))
        await db.commit()
        msg = {
            "type": "contribution",
            "amount": float(amount),
            "description": description,
            "balance": float(wallet.balance),
        }
        from app.utils.redis_client import publish
        await publish(f"shared_wallet:{wallet_id}", msg)
        return wallet

    async def _member_spent_totals(self, db: AsyncSession, wallet_id: UUID) -> dict[str, float]:
        result = await db.execute(
            select(SharedWalletEntry.user_id, func.sum(SharedWalletEntry.amount)).where(
                SharedWalletEntry.wallet_id == wallet_id,
                SharedWalletEntry.entry_type == "expense",
            ).group_by(SharedWalletEntry.user_id)
        )
        return {str(uid): float(total) for uid, total in result.all()}

    async def get_member_summary(self, db: AsyncSession, wallet_id: UUID, user_id: UUID) -> dict:
        wallet = await db.get(SharedWallet, wallet_id)
        if not wallet or not await self.is_member(db, wallet_id, user_id):
            raise I18nError("social.wallet_not_member")
        members = json.loads(wallet.member_ids or "[]")
        summaries = []
        for mid in members:
            uid = UUID(mid)
            user = await db.get(User, uid)
            spent_r = await db.execute(
                select(func.coalesce(func.sum(SharedWalletEntry.amount), 0)).where(
                    SharedWalletEntry.wallet_id == wallet_id,
                    SharedWalletEntry.user_id == uid,
                    SharedWalletEntry.entry_type == "expense",
                )
            )
            contrib_r = await db.execute(
                select(func.coalesce(func.sum(SharedWalletEntry.amount), 0)).where(
                    SharedWalletEntry.wallet_id == wallet_id,
                    SharedWalletEntry.user_id == uid,
                    SharedWalletEntry.entry_type == "contribution",
                )
            )
            spent = Decimal(str(spent_r.scalar() or 0))
            contributed = Decimal(str(contrib_r.scalar() or 0))
            summaries.append({
                "user_id": mid,
                "name": (user.full_name or user.email) if user else mid,
                "spent": float(spent),
                "contributed": float(contributed),
                "net": float(contributed - spent),
            })
        return {
            "wallet_id": str(wallet.id),
            "name": wallet.name,
            "balance": float(wallet.balance),
            "members": summaries,
        }
