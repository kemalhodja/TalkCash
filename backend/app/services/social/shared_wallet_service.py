import json
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError
from app.models.social import SharedWallet


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
        wallet.balance -= amount
        await db.commit()
        msg = {
            "type": "expense",
            "amount": float(amount),
            "description": description,
            "by": user_name,
            "balance": float(wallet.balance),
        }
        from app.utils.redis_client import publish
        await publish(f"shared_wallet:{wallet_id}", msg)
        return wallet
