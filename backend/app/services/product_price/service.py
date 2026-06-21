from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.product_history import ProductHistory
from app.services.product_price.helpers import (
    PRICE_DIFF_THRESHOLD,
    display_product,
    first_name,
    normalize_product,
    normalize_store,
    price_diff_percent,
)


class ProductPriceService:
    async def record_and_compare(
        self,
        db: AsyncSession,
        user_id: UUID,
        product_name: str,
        store_name: str,
        price: Decimal,
        *,
        transaction_id: UUID | None = None,
        locale: str = "tr",
        user_name: str | None = None,
    ) -> dict | None:
        product_key = normalize_product(product_name)
        store_key = normalize_store(store_name)
        if not product_key or not store_key or price is None or price <= 0:
            return None

        result = await db.execute(
            select(ProductHistory)
            .where(
                ProductHistory.user_id == user_id,
                ProductHistory.product_name == product_key,
                func.lower(ProductHistory.store_name) != store_key,
            )
            .order_by(ProductHistory.created_at.desc())
            .limit(1)
        )
        previous = result.scalar_one_or_none()

        db.add(ProductHistory(
            user_id=user_id,
            product_name=product_key[:255],
            store_name=store_name.strip()[:255],
            price=price,
            transaction_id=transaction_id,
        ))
        await db.commit()

        if not previous:
            return None

        prev_price = float(previous.price)
        cur_price = float(price)
        if prev_price <= 0:
            return None

        diff_pct = abs(cur_price - prev_price) / prev_price
        if diff_pct < PRICE_DIFF_THRESHOLD:
            return None

        diff_amount = abs(cur_price - prev_price)
        pct = price_diff_percent(cur_price, prev_price)
        product_label = display_product(product_name)
        name = first_name(user_name)
        speech_key = "price_compare.speech_higher" if cur_price > prev_price else "price_compare.speech_lower"
        speech = t(
            speech_key,
            locale,
            product=product_label,
            product_lower=product_label.lower(),
            name_part=f" {name}" if name else "",
            current_store=store_name.strip(),
            previous_store=previous.store_name,
            current_price=f"{cur_price:.2f}",
            previous_price=f"{prev_price:.2f}",
            diff=f"{diff_amount:.2f}",
            percent=str(pct),
        )

        return {
            "action": "trigger_voice_alert",
            "current_store": store_name.strip(),
            "previous_store": previous.store_name,
            "current_price": cur_price,
            "previous_price": prev_price,
            "percent_diff": pct,
            "product": product_label,
            "speech_text": speech,
        }
