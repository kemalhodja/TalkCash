from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import ROUND_CEILING, Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError, t
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.models.wallet import Wallet, WalletType
from app.services.micro_savings.prefs import get_user_micro_savings_prefs
from app.services.wallet.service import WalletService

DAILY_NUDGE_ENTITLEMENT = "swap_nudges"
MIN_SAVINGS = Decimal("5")
MIN_ROUND_UP = Decimal("1")
MICRO_SAVINGS_INPUT = "micro_savings"
MAX_MICRO_SAVINGS_TRANSFER = Decimal("250000")


@dataclass(frozen=True)
class SwapRule:
    key: str
    keywords: tuple[str, ...]
    target: WalletType
    target_label_tr: str
    target_label_en: str
    alternative_tr: str
    alternative_en: str
    home_cost: Decimal | None = None
    home_cost_ratio: float | None = None


SWAP_RULES: tuple[SwapRule, ...] = (
    SwapRule(
        key="coffee",
        keywords=(
            "kahve", "coffee", "latte", "cappuccino", "espresso", "starbucks", "mocha",
            "dunkin", "costa", "nespresso", "cafe", "café", "barista",
        ),
        home_cost=Decimal("8"),
        alternative_tr="evde kahve",
        alternative_en="coffee at home",
        target=WalletType.INVESTMENT_GOLD,
        target_label_tr="Altın",
        target_label_en="Gold",
    ),
    SwapRule(
        key="delivery",
        keywords=(
            "yemeksepeti", "getir yemek", "delivery", "sipariş", "takeaway", "uber eats",
            "trendyol go", "doordash", "grubhub", "deliveroo", "just eat", "food delivery",
            "postmates", "wolt", "glovo",
        ),
        home_cost_ratio=0.35,
        alternative_tr="evde yemek",
        alternative_en="a home-cooked meal",
        target=WalletType.INVESTMENT_FOREX,
        target_label_tr="Döviz",
        target_label_en="Forex",
    ),
    SwapRule(
        key="taxi",
        keywords=(
            "taxi", "taksi", "uber", "bitaksi", "bolt", "lyft", "cab", "rideshare",
            "ride share", "grab", "careem", "via",
        ),
        home_cost_ratio=0.25,
        alternative_tr="toplu taşıma",
        alternative_en="public transit",
        target=WalletType.INVESTMENT_GOLD,
        target_label_tr="Altın",
        target_label_en="Gold",
    ),
    SwapRule(
        key="snacks",
        keywords=(
            "cips", "çikolata", "snack", "atıştırmalık", "kuruyemiş", "chips", "candy",
            "chocolate", "cookies", "cookie", "ice cream", "donut", "doughnut", "vending",
        ),
        home_cost_ratio=0.5,
        alternative_tr="evden atıştırmalık",
        alternative_en="snacks from home",
        target=WalletType.INVESTMENT_GOLD,
        target_label_tr="Altın",
        target_label_en="Gold",
    ),
)

SWAP_RULE_KEYS = frozenset(r.key for r in SWAP_RULES)
ALLOWED_TRANSFER_RULE_KEYS = SWAP_RULE_KEYS | frozenset({"round_up"})


class MicroSavingsService:
    def __init__(self):
        self.wallets = WalletService()

    async def _transferable_from_source(
        self,
        db: AsyncSession,
        user_id: UUID,
        source_wallet_id: UUID,
        amount: Decimal,
        *,
        min_amount: Decimal = MIN_SAVINGS,
    ) -> Decimal | None:
        wallet = await self.wallets.get_owned_wallet(db, user_id, source_wallet_id)
        if wallet.wallet_type == WalletType.CREDIT_CARD:
            return None
        if wallet.balance < min_amount:
            return None
        capped = min(amount, wallet.balance).quantize(Decimal("0.01"))
        if capped < min_amount:
            return None
        return capped

    async def _validate_transfer_wallets(
        self,
        db: AsyncSession,
        user_id: UUID,
        from_wallet_id: UUID,
        to_wallet_id: UUID,
    ) -> tuple[Wallet, Wallet]:
        from_w = await self.wallets.get_owned_wallet(db, user_id, from_wallet_id)
        to_w = await self.wallets.get_owned_wallet(db, user_id, to_wallet_id)
        if from_w.wallet_type == WalletType.CREDIT_CARD:
            raise I18nError("micro_savings.credit_card_source")
        if to_w.wallet_type not in (WalletType.INVESTMENT_GOLD, WalletType.INVESTMENT_FOREX):
            raise I18nError("micro_savings.invalid_target_wallet")
        return from_w, to_w

    def _match_rule(self, description: str, category: str) -> SwapRule | None:
        haystack = f"{description} {category}".lower()
        for rule in SWAP_RULES:
            if any(kw in haystack for kw in rule.keywords):
                return rule
        return None

    def _alternative_cost(self, rule: SwapRule, amount: Decimal) -> Decimal:
        if rule.home_cost is not None:
            return min(rule.home_cost, amount)
        if rule.home_cost_ratio is not None:
            return (amount * Decimal(str(rule.home_cost_ratio))).quantize(Decimal("0.01"))
        return Decimal("0")

    def evaluate(
        self,
        description: str,
        category: str,
        amount: Decimal,
        locale: str = "tr",
    ) -> dict | None:
        if amount <= 0:
            return None
        rule = self._match_rule(description, category)
        if not rule:
            return None
        alt_cost = self._alternative_cost(rule, amount)
        saved = (amount - alt_cost).quantize(Decimal("0.01"))
        if saved < MIN_SAVINGS:
            return None
        alternative = rule.alternative_tr if locale == "tr" else rule.alternative_en
        target_label = rule.target_label_tr if locale == "tr" else rule.target_label_en
        speech = t(
            "micro_savings.speech",
            locale,
            alternative=alternative,
            saved=f"{saved:.2f}",
            target=target_label,
        )
        return {
            "rule_key": rule.key,
            "saved_amount": float(saved),
            "actual_amount": float(amount),
            "alternative_cost": float(alt_cost),
            "alternative": alternative,
            "target_wallet_type": rule.target.value,
            "target_label": target_label,
            "speech_text": speech,
        }

    async def _wallet_by_type(self, db: AsyncSession, user_id: UUID, wallet_type: WalletType) -> Wallet | None:
        result = await db.execute(
            select(Wallet).where(
                Wallet.user_id == user_id,
                Wallet.is_active == True,
                Wallet.wallet_type == wallet_type,
            )
        )
        return result.scalars().first()

    async def build_nudge(
        self,
        db: AsyncSession,
        user_id: UUID,
        description: str,
        category: str,
        amount: Decimal,
        source_wallet_id: UUID | None,
        locale: str = "tr",
        *,
        check_limit: bool = True,
    ) -> dict | None:
        base = self.evaluate(description, category, amount, locale)
        if not base:
            return None
        target = await self._wallet_by_type(db, user_id, WalletType(base["target_wallet_type"]))
        if not target:
            return None
        base["target_wallet_id"] = str(target.id)
        base["target_wallet_name"] = target.name
        if source_wallet_id:
            transferable = await self._transferable_from_source(
                db, user_id, source_wallet_id, Decimal(str(base["saved_amount"])),
            )
            if transferable is None:
                return None
            if transferable != Decimal(str(base["saved_amount"])):
                base["saved_amount"] = float(transferable)
                rule = self._match_rule(description, category)
                if rule:
                    alternative = rule.alternative_tr if locale == "tr" else rule.alternative_en
                    target_label = rule.target_label_tr if locale == "tr" else rule.target_label_en
                    base["speech_text"] = t(
                        "micro_savings.speech",
                        locale,
                        alternative=alternative,
                        saved=f"{transferable:.2f}",
                        target=target_label,
                    )
            base["source_wallet_id"] = str(source_wallet_id)

        if check_limit:
            from app.services.billing.service import BillingService

            billing = BillingService()
            status = await billing.get_status(db, user_id)
            ent = status.entitlements.get(DAILY_NUDGE_ENTITLEMENT)
            if not ent or not ent.enabled or (ent.remaining is not None and ent.remaining <= 0):
                base["locked"] = True
                base["upgrade_message"] = t("micro_savings.nudge_limit", locale)
                if ent:
                    base["nudge_limit"] = ent.limit
                    base["nudge_used"] = ent.used
                return base
            if ent.remaining is not None:
                base["nudge_remaining"] = ent.remaining

        return base

    def compute_round_up(self, amount: Decimal, step: int) -> tuple[Decimal, Decimal] | None:
        step_d = Decimal(str(step))
        if amount <= 0 or step_d <= 0:
            return None
        quotient = (amount / step_d).to_integral_value(rounding=ROUND_CEILING)
        rounded = quotient * step_d
        spare = (rounded - amount).quantize(Decimal("0.01"))
        if spare < MIN_ROUND_UP:
            return None
        return rounded, spare

    async def build_round_up(
        self,
        db: AsyncSession,
        user: User,
        amount: Decimal,
        source_wallet_id: UUID | None,
        locale: str = "tr",
    ) -> dict | None:
        prefs = get_user_micro_savings_prefs(user)
        if not prefs.get("round_up_enabled"):
            return None
        step = int(prefs.get("round_up_step", 10))
        computed = self.compute_round_up(amount, step)
        if not computed:
            return None
        rounded, spare = computed
        try:
            wallet_type = WalletType(prefs.get("default_investment_wallet", "investment_gold"))
        except ValueError:
            wallet_type = WalletType.INVESTMENT_GOLD
        target = await self._wallet_by_type(db, user.id, wallet_type)
        if not target:
            return None
        speech = t(
            "micro_savings.round_up_speech",
            locale,
            spare=f"{spare:.2f}",
            target=target.name,
            rounded=f"{rounded:.2f}",
        )
        payload = {
            "rule_key": "round_up",
            "spare_amount": float(spare),
            "original_amount": float(amount),
            "rounded_to": float(rounded),
            "step": step,
            "target_wallet_id": str(target.id),
            "target_wallet_name": target.name,
            "target_wallet_type": wallet_type.value,
            "speech_text": speech,
        }
        if source_wallet_id:
            transferable = await self._transferable_from_source(
                db, user.id, source_wallet_id, spare, min_amount=MIN_ROUND_UP,
            )
            if transferable is None:
                return None
            if transferable != spare:
                payload["spare_amount"] = float(transferable)
                payload["speech_text"] = t(
                    "micro_savings.round_up_speech",
                    locale,
                    spare=f"{transferable:.2f}",
                    target=target.name,
                    rounded=f"{(amount + transferable).quantize(Decimal('0.01')):.2f}",
                )
            payload["source_wallet_id"] = str(source_wallet_id)
        return payload

    async def process_post_expense(
        self,
        db: AsyncSession,
        user: User,
        description: str,
        category: str,
        amount: Decimal,
        source_wallet_id: UUID | None,
        locale: str = "tr",
    ) -> dict:
        extras: dict = {}
        swap = await self.build_nudge(
            db, user.id, description, category, amount, source_wallet_id, locale,
        )
        if swap:
            extras["swap_nudge"] = swap

        round_up = await self.build_round_up(db, user, amount, source_wallet_id, locale)
        if not round_up:
            return extras

        prefs = get_user_micro_savings_prefs(user)
        if prefs.get("auto_round_up"):
            from app.services.billing.service import BillingService, PremiumRequiredError

            billing = BillingService()
            try:
                await billing.verify_premium_status(db, user.id)
                if round_up.get("source_wallet_id") and round_up.get("target_wallet_id"):
                    await self.transfer_savings(
                        db,
                        user.id,
                        UUID(round_up["source_wallet_id"]),
                        UUID(round_up["target_wallet_id"]),
                        Decimal(str(round_up["spare_amount"])),
                        "round_up",
                        locale,
                    )
                    round_up["auto_applied"] = True
                    extras["round_up"] = round_up
                    return extras
            except PremiumRequiredError:
                round_up["auto_requires_premium"] = True

        extras["round_up"] = round_up
        return extras

    async def transfer_savings(
        self,
        db: AsyncSession,
        user_id: UUID,
        from_wallet_id: UUID,
        to_wallet_id: UUID,
        amount: Decimal,
        rule_key: str,
        locale: str = "tr",
    ) -> dict:
        from app.services.billing.service import BillingService, EntitlementError

        if rule_key not in ALLOWED_TRANSFER_RULE_KEYS:
            raise I18nError("micro_savings.invalid_rule_key")
        if amount > MAX_MICRO_SAVINGS_TRANSFER:
            raise I18nError("micro_savings.transfer_too_large")

        await self._validate_transfer_wallets(db, user_id, from_wallet_id, to_wallet_id)

        if rule_key in SWAP_RULE_KEYS:
            billing = BillingService()
            try:
                await billing.consume_daily_usage(db, user_id, DAILY_NUDGE_ENTITLEMENT)
            except EntitlementError as e:
                raise EntitlementError(e.key) from e

        if rule_key == "round_up":
            to_wallet = await self.wallets.get_owned_wallet(db, user_id, to_wallet_id)
            desc = t(
                "micro_savings.round_up_transfer",
                locale,
                amount=f"{amount:.2f}",
                target=to_wallet.name,
            )
        else:
            label = next(
                (r.target_label_tr if locale == "tr" else r.target_label_en for r in SWAP_RULES if r.key == rule_key),
                rule_key,
            )
            desc = t("micro_savings.transfer_description", locale, rule=rule_key, target=label)
        from_w, to_w = await self.wallets.transfer(
            db, user_id, from_wallet_id, to_wallet_id, amount, desc, input_method=MICRO_SAVINGS_INPUT,
        )
        return {
            "from_balance": float(from_w.balance),
            "to_balance": float(to_w.balance),
            "amount": float(amount),
            "rule_key": rule_key,
        }

    async def get_summary(self, db: AsyncSession, user_id: UUID, *, include_projection: bool = False) -> dict:
        now = datetime.utcnow()
        week_start = now - timedelta(days=7)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        async def _sum_since(since: datetime) -> tuple[float, int]:
            result = await db.execute(
                select(
                    func.coalesce(func.sum(Transaction.amount), 0),
                    func.count(Transaction.id),
                ).where(
                    Transaction.user_id == user_id,
                    Transaction.transaction_type == TransactionType.TRANSFER,
                    Transaction.input_method == MICRO_SAVINGS_INPUT,
                    Transaction.created_at >= since,
                )
            )
            row = result.one()
            return float(row[0]), int(row[1])

        week_total, week_count = await _sum_since(week_start)
        month_total, month_count = await _sum_since(month_start)

        investment_result = await db.execute(
            select(Wallet.wallet_type, func.coalesce(func.sum(Wallet.balance), 0)).where(
                Wallet.user_id == user_id,
                Wallet.is_active == True,
                Wallet.wallet_type.in_([WalletType.INVESTMENT_GOLD, WalletType.INVESTMENT_FOREX]),
            ).group_by(Wallet.wallet_type)
        )
        investment_balances = {row[0].value: float(row[1]) for row in investment_result.all()}
        investment_total = sum(investment_balances.values())

        payload: dict = {
            "week_saved": week_total,
            "week_transfer_count": week_count,
            "month_saved": month_total,
            "month_transfer_count": month_count,
            "investment_total": investment_total,
            "investment_balances": investment_balances,
        }
        if include_projection and month_total > 0:
            payload["year_projection"] = round(month_total * 12, 2)
            payload["monthly_projection"] = self._build_monthly_projection(
                month_total, investment_total,
            )
        from app.services.micro_savings.rates import enrich_summary_with_live_rates

        return await enrich_summary_with_live_rates(db, payload)

    def _build_monthly_projection(self, monthly_add: float, starting_balance: float) -> list[dict]:
        cumulative = starting_balance
        rows: list[dict] = []
        for month in range(1, 13):
            cumulative = round(cumulative + monthly_add, 2)
            rows.append({
                "month": month,
                "added": round(monthly_add, 2),
                "cumulative": cumulative,
            })
        return rows

    async def _recent_monthly_pace(self, db: AsyncSession, user_id: UUID) -> float:
        """Average micro-savings pace based on last 30 days."""
        since = datetime.utcnow() - timedelta(days=30)
        result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.transaction_type == TransactionType.TRANSFER,
                Transaction.input_method == MICRO_SAVINGS_INPUT,
                Transaction.created_at >= since,
            )
        )
        total = float(result.scalar() or 0)
        return round(total, 2) if total > 0 else 0.0

    async def get_premium_insights(self, db: AsyncSession, user_id: UUID, locale: str = "tr") -> dict:
        from app.services.micro_savings.portfolio import PortfolioCoachService

        summary = await self.get_summary(db, user_id, include_projection=True)
        pace = await self._recent_monthly_pace(db, user_id)
        if pace > 0:
            summary["monthly_projection"] = self._build_monthly_projection(
                pace, summary["investment_total"],
            )
            summary["year_projection"] = round(pace * 12 + summary["investment_total"], 2)
            summary["projection_basis"] = "last_30_days"
        else:
            summary["projection_basis"] = "current_month"
        summary["portfolio"] = await PortfolioCoachService().analyze(db, user_id, locale)
        return summary
