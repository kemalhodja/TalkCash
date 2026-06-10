from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.wallet.service import WalletService
from app.utils.security import create_access_token, hash_password, verify_password


class AuthService:
    def __init__(self):
        self.wallet_service = WalletService()

    async def register(self, db: AsyncSession, email: str, password: str, full_name: str = "") -> tuple[User, str]:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalars().first():
            raise ValueError("Bu e-posta zaten kayıtlı")

        user = User(email=email, hashed_password=hash_password(password), full_name=full_name)
        db.add(user)
        await db.flush()
        await self.wallet_service.create_defaults(db, user.id)
        await db.commit()
        await db.refresh(user)
        return user, create_access_token(user.id)

    async def login(self, db: AsyncSession, email: str, password: str) -> tuple[User, str]:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if not user or not verify_password(password, user.hashed_password):
            raise ValueError("E-posta veya şifre hatalı")
        return user, create_access_token(user.id)

    async def set_pin(self, db: AsyncSession, user_id: UUID, pin: str) -> None:
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("Kullanıcı bulunamadı")
        user.pin_code = hash_password(pin)
        await db.commit()

    async def verify_pin(self, db: AsyncSession, user_id: UUID, pin: str) -> bool:
        user = await db.get(User, user_id)
        if not user or not user.pin_code:
            return False
        return verify_password(pin, user.pin_code)

    async def toggle_biometric(self, db: AsyncSession, user_id: UUID, enabled: bool) -> None:
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("Kullanıcı bulunamadı")
        user.biometric_enabled = enabled
        await db.commit()

    async def set_push_token(self, db: AsyncSession, user_id: UUID, token: str) -> None:
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("Kullanıcı bulunamadı")
        user.push_token = token
        await db.commit()
