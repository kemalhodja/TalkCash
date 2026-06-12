from datetime import datetime
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError
from app.models.shopping import ShoppingCategory, ShoppingItem
from app.services.wallet.service import WalletService

CATEGORY_KEYWORDS = {
    ShoppingCategory.BUTCHER: [
        "et", "sucuk", "sosis", "tavuk", "köfte", "kofte",
        "meat", "chicken", "beef", "sausage", "steak",
    ],
    ShoppingCategory.GREENS: [
        "domates", "salatalık", "salatalik", "biber", "marul", "meyve",
        "tomato", "cucumber", "pepper", "lettuce", "fruit", "apple", "banana",
    ],
    ShoppingCategory.DAIRY: [
        "süt", "sut", "yumurta", "peynir", "yoğurt", "yogurt", "tereyağı",
        "milk", "egg", "cheese", "yogurt", "butter", "cream",
    ],
    ShoppingCategory.CLEANING: [
        "deterjan", "sabun", "temizlik", "bulaşık", "bulasik",
        "detergent", "soap", "cleaning", "bleach", "sponge",
    ],
    ShoppingCategory.BAKERY: [
        "ekmek", "simit", "poğaça", "pogaca",
        "bread", "bagel", "pastry", "roll",
    ],
    ShoppingCategory.BEVERAGE: [
        "su", "kola", "meyve suyu", "çay", "cay", "kahve",
        "water", "cola", "juice", "tea", "coffee", "soda",
    ],
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
            raise I18nError("shopping.item_not_found")

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

    async def delete_item(self, db: AsyncSession, user_id: UUID, item_id: UUID) -> None:
        item = await db.get(ShoppingItem, item_id)
        if not item or item.user_id != user_id:
            raise I18nError("shopping.item_not_found")
        await db.delete(item)
        await db.commit()

    async def import_from_receipt(
        self, db: AsyncSession, user_id: UUID, receipt_id: UUID,
        item_names: list[str] | None = None,
    ) -> list[ShoppingItem]:
        from app.models.receipt import Receipt
        from app.services.ocr.service import OCRService

        receipt = await db.get(Receipt, receipt_id)
        if not receipt or receipt.user_id != user_id:
            raise I18nError("ocr.receipt_not_found")
        if not receipt.ocr_raw_text:
            raise I18nError("ocr.no_text")

        ocr = OCRService()
        line_items = ocr._extract_line_items(receipt.ocr_raw_text)
        names = [li["name"] for li in line_items if li.get("name")]
        if item_names:
            wanted = {n.lower().strip() for n in item_names}
            names = [n for n in names if n.lower().strip() in wanted]
        if not names:
            raise I18nError("shopping.no_items_to_import")
        return await self.add_items(db, user_id, names)

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

        from app.config import settings
        local_now = datetime.now(ZoneInfo(settings.app_timezone))
        is_monday = local_now.weekday() == 0
        all_routines = await db.execute(
            select(ShoppingItem).where(ShoppingItem.is_routine == True)
        )
        for routine in all_routines.scalars().all():
            if routine.routine_type == "weekly" and not is_monday:
                continue
            if routine.name not in existing_routine_names:
                db.add(ShoppingItem(
                    user_id=routine.user_id, name=routine.name,
                    category=routine.category, is_routine=True,
                    routine_type=routine.routine_type,
                ))

        await db.commit()
        return len(completed)
