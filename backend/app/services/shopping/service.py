from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shopping import ShoppingCategory, ShoppingItem
from app.services.wallet.service import WalletService

CATEGORY_KEYWORDS = {
    ShoppingCategory.BUTCHER: ["et", "sucuk", "sosis", "tavuk", "köfte", "kofte"],
    ShoppingCategory.GREENS: ["domates", "salatalık", "salatalik", "biber", "marul", "meyve"],
    ShoppingCategory.DAIRY: ["süt", "sut", "yumurta", "peynir", "yoğurt", "yogurt", "tereyağı"],
    ShoppingCategory.CLEANING: ["deterjan", "sabun", "temizlik", "bulaşık", "bulasik"],
    ShoppingCategory.BAKERY: ["ekmek", "simit", "poğaça", "pogaca"],
    ShoppingCategory.BEVERAGE: ["su", "kola", "meyve suyu", "çay", "cay", "kahve"],
}


class ShoppingService:
    def __init__(self):
        self.wallet_service = WalletService()

    def categorize(self, name: str) -> ShoppingCategory:
        name_lower = name.lower()
        for category, keywords in CATEGORY_KEYWORDS.items():
            if any(kw in name_lower for kw in keywords):
                return category
        return ShoppingCategory.OTHER

    async def add_items(self, db: AsyncSession, user_id: UUID, items: list[str]) -> list[ShoppingItem]:
        created = []
        for name in items:
            item = ShoppingItem(
                user_id=user_id, name=name.strip(),
                category=self.categorize(name),
            )
            db.add(item)
            created.append(item)
        await db.commit()
        return created

    async def list_active(self, db: AsyncSession, user_id: UUID) -> list[ShoppingItem]:
        result = await db.execute(
            select(ShoppingItem).where(
                ShoppingItem.user_id == user_id,
                ShoppingItem.is_completed == False,
            ).order_by(ShoppingItem.category, ShoppingItem.name)
        )
        return list(result.scalars().all())

    async def complete_item(
        self, db: AsyncSession, user_id: UUID, item_id: UUID,
        price: Decimal | None = None, wallet_id: UUID | None = None,
    ) -> ShoppingItem:
        item = await db.get(ShoppingItem, item_id)
        if not item:
            raise ValueError("Ürün bulunamadı")

        item.is_completed = True
        item.completed_at = datetime.utcnow()
        item.price = price

        if price and wallet_id:
            await self.wallet_service.add_expense(
                db, user_id, wallet_id, price,
                category="Market", description=item.name, input_method="shopping",
            )
        await db.commit()
        return item

    async def daily_reset(self, db: AsyncSession) -> int:
        result = await db.execute(
            select(ShoppingItem).where(ShoppingItem.is_completed == True)
        )
        completed = list(result.scalars().all())
        for item in completed:
            await db.delete(item)

        routines = await db.execute(
            select(ShoppingItem).where(
                ShoppingItem.is_routine == True,
                ShoppingItem.is_completed == False,
            )
        )
        existing_routine_names = {item.name for item in routines.scalars().all()}

        all_routines = await db.execute(
            select(ShoppingItem).where(ShoppingItem.is_routine == True)
        )
        for routine in all_routines.scalars().all():
            if routine.name not in existing_routine_names:
                db.add(ShoppingItem(
                    user_id=routine.user_id, name=routine.name,
                    category=routine.category, is_routine=True,
                    routine_type=routine.routine_type,
                ))

        await db.commit()
        return len(completed)
