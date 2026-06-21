from datetime import datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.i18n import t
from app.models.product_rule import ShoppingSuggestionLog, UserProductRule
from app.models.shopping import ShoppingCategory, ShoppingItem
from app.services.shopping.association import mine_association_rules, normalize_product
from app.services.shopping.category_keywords import categorize_shopping_item

MAX_DAILY_VOICE_SUGGESTIONS = 2
MIN_BASKETS_FOR_MINING = 3


def _categorize(name: str) -> ShoppingCategory:
    return categorize_shopping_item(name)


class PredictiveShoppingService:
    def _local_now(self) -> datetime:
        return datetime.now(ZoneInfo(settings.app_timezone))

    def _time_bucket(self, hour: int) -> str:
        if 6 <= hour < 11:
            return "morning"
        if 11 <= hour < 17:
            return "afternoon"
        if 17 <= hour < 22:
            return "evening"
        return "night"

    def _day_type(self, dt: datetime) -> str:
        return "weekend" if dt.weekday() >= 5 else "weekday"

    def _basket_key(self, item: ShoppingItem) -> str:
        ts = item.completed_at or item.created_at
        return ts.strftime("%Y-%m-%d")

    def _basket_context(self, items: list[ShoppingItem]) -> tuple[str, str]:
        sample = items[0]
        ts = sample.completed_at or sample.created_at
        return self._time_bucket(ts.hour), self._day_type(ts)

    async def rebuild_user_rules(self, db: AsyncSession, user_id: UUID) -> int:
        result = await db.execute(
            select(ShoppingItem).where(ShoppingItem.user_id == user_id)
        )
        items = list(result.scalars().all())
        if not items:
            return 0

        baskets_map: dict[str, list[ShoppingItem]] = {}
        for item in items:
            key = self._basket_key(item)
            baskets_map.setdefault(key, []).append(item)

        if len(baskets_map) < MIN_BASKETS_FOR_MINING:
            return 0

        basket_records: list[tuple[list[str], str, str]] = []
        for basket_items in baskets_map.values():
            names = [i.name for i in basket_items]
            time_bucket, day_type = self._basket_context(basket_items)
            basket_records.append((names, time_bucket, day_type))

        baskets = [names for names, _, _ in basket_records]
        rules = mine_association_rules(baskets)
        await db.execute(delete(UserProductRule).where(UserProductRule.user_id == user_id))

        pair_context: dict[tuple[str, str], dict[str, str]] = {}
        for names, time_bucket, day_type in basket_records:
            normalized = {normalize_product(n) for n in names if n.strip()}
            for a in normalized:
                for b in normalized:
                    if a == b:
                        continue
                    key = (a, b)
                    if key not in pair_context:
                        pair_context[key] = {
                            "time_bucket": time_bucket,
                            "day_type": day_type,
                        }

        now = datetime.utcnow()
        for product_id, suggested_id, confidence in rules:
            ctx = pair_context.get((product_id, suggested_id), {})
            trigger_cat = _categorize(product_id).value
            suggested_cat = _categorize(suggested_id).value
            db.add(UserProductRule(
                user_id=user_id,
                product_id=product_id,
                suggested_product_id=suggested_id,
                confidence_score=confidence,
                context_time_bucket=ctx.get("time_bucket"),
                context_day_type=ctx.get("day_type"),
                trigger_category=trigger_cat,
                suggested_category=suggested_cat,
                updated_at=now,
            ))

        await db.commit()
        return len(rules)

    async def rebuild_all_users(self, db: AsyncSession) -> int:
        result = await db.execute(select(ShoppingItem.user_id).distinct())
        user_ids = [row[0] for row in result.all()]
        total = 0
        for user_id in user_ids:
            total += await self.rebuild_user_rules(db, user_id)
        return total

    async def _daily_suggestion_count(self, db: AsyncSession, user_id: UUID) -> int:
        since = datetime.utcnow() - timedelta(days=1)
        result = await db.execute(
            select(func.count()).select_from(ShoppingSuggestionLog).where(
                ShoppingSuggestionLog.user_id == user_id,
                ShoppingSuggestionLog.created_at >= since,
            )
        )
        return int(result.scalar() or 0)

    def _score_rule(
        self,
        rule: UserProductRule,
        trigger_category: ShoppingCategory,
        time_bucket: str,
        day_type: str,
    ) -> float:
        score = float(rule.confidence_score)
        if rule.context_time_bucket:
            score += 0.08 if rule.context_time_bucket == time_bucket else -0.12
        if rule.context_day_type:
            score += 0.06 if rule.context_day_type == day_type else -0.1
        if rule.trigger_category and rule.trigger_category == trigger_category.value:
            score += 0.1
        if rule.suggested_category and rule.suggested_category != trigger_category.value:
            score += 0.04
        return score

    async def find_complement(
        self,
        db: AsyncSession,
        user_id: UUID,
        new_items: list[str],
        existing_active_names: list[str],
        locale: str = "tr",
    ) -> dict | None:
        if not new_items:
            return None

        if await self._daily_suggestion_count(db, user_id) >= MAX_DAILY_VOICE_SUGGESTIONS:
            return None

        now = self._local_now()
        time_bucket = self._time_bucket(now.hour)
        day_type = self._day_type(now)

        new_lower = {normalize_product(i) for i in new_items}
        active_lower = {normalize_product(i) for i in existing_active_names}

        best: tuple[float, UserProductRule, str] | None = None

        for product in new_items:
            product_key = normalize_product(product)
            if not product_key:
                continue
            trigger_category = _categorize(product)

            result = await db.execute(
                select(UserProductRule).where(
                    UserProductRule.user_id == user_id,
                    UserProductRule.product_id == product_key,
                )
            )
            rules = list(result.scalars().all())

            for rule in rules:
                suggested = rule.suggested_product_id
                if suggested in new_lower or suggested in active_lower:
                    continue

                score = self._score_rule(rule, trigger_category, time_bucket, day_type)
                if score < 0.25:
                    continue
                if not best or score > best[0]:
                    best = (score, rule, product.strip())

        if not best:
            return None

        _, rule, trigger_product = best
        display = self._display_name(rule.suggested_product_id, existing_active_names, new_items)
        speech = t(
            "shopping.suggest_speech",
            locale,
            product=trigger_product,
            suggested=display,
        )
        return {
            "hasSuggestion": True,
            "suggestedItem": display,
            "triggerProduct": trigger_product,
            "confidenceScore": rule.confidence_score,
            "speechText": speech,
        }

    def _display_name(self, normalized: str, *name_lists: list[str]) -> str:
        for names in name_lists:
            for name in names:
                if normalize_product(name) == normalized:
                    return name.strip()
        return normalized

    async def log_voice_suggestion(self, db: AsyncSession, user_id: UUID, suggested_item: str) -> None:
        db.add(ShoppingSuggestionLog(
            user_id=user_id,
            suggested_item=suggested_item.strip(),
        ))
        await db.commit()
