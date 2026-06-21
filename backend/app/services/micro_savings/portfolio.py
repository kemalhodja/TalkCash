from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.wallet import WalletType
from app.services.wallet.service import WalletService


# Educational targets for the investment-wallet slice (not regulated advice).
TARGET_GOLD_SHARE = 0.55
TARGET_FOREX_SHARE = 0.45


class PortfolioCoachService:
    def __init__(self):
        self.wallets = WalletService()

    async def analyze(self, db: AsyncSession, user_id: UUID, locale: str = "tr") -> dict:
        net = await self.wallets.get_net_worth(db, user_id)
        buckets: dict[str, float] = {
            "cash": 0.0,
            "gold": 0.0,
            "forex": 0.0,
            "debt": 0.0,
        }
        for w in net.wallets:
            val = float(w.balance_try)
            if w.wallet_type == WalletType.CREDIT_CARD.value:
                buckets["debt"] += val
            elif w.wallet_type == WalletType.INVESTMENT_GOLD.value:
                buckets["gold"] += val
            elif w.wallet_type == WalletType.INVESTMENT_FOREX.value:
                buckets["forex"] += val
            else:
                buckets["cash"] += val

        total_assets = buckets["cash"] + buckets["gold"] + buckets["forex"]
        investment_total = buckets["gold"] + buckets["forex"]
        net_total = float(net.total_try)

        if investment_total > 0:
            gold_share = buckets["gold"] / investment_total
            forex_share = buckets["forex"] / investment_total
        else:
            gold_share = 0.0
            forex_share = 0.0

        cash_share = (buckets["cash"] / total_assets) if total_assets > 0 else 1.0
        investment_share = (investment_total / total_assets) if total_assets > 0 else 0.0

        tips: list[str] = []
        if investment_total <= 0:
            tips.append(t("portfolio.no_investment", locale))
        else:
            if gold_share < TARGET_GOLD_SHARE - 0.15:
                tips.append(t("portfolio.tilt_gold", locale, current=f"{gold_share * 100:.0f}"))
            elif gold_share > TARGET_GOLD_SHARE + 0.15:
                tips.append(t("portfolio.tilt_forex", locale, current=f"{gold_share * 100:.0f}"))
            else:
                tips.append(t("portfolio.balanced", locale))

        if investment_share < 0.05 and buckets["cash"] > 500:
            tips.append(t("portfolio.low_investment_share", locale, percent=f"{investment_share * 100:.0f}"))

        if buckets["debt"] > buckets["cash"] * 0.5:
            tips.append(t("portfolio.high_debt", locale))

        # Simple health score 0–100
        score = 50
        if investment_total > 0:
            score += 20
        balance_delta = abs(gold_share - TARGET_GOLD_SHARE) + abs(forex_share - TARGET_FOREX_SHARE)
        score += max(0, 30 - int(balance_delta * 100))
        score = max(0, min(100, score))

        return {
            "net_worth": net_total,
            "allocation": {
                "cash": round(buckets["cash"], 2),
                "gold": round(buckets["gold"], 2),
                "forex": round(buckets["forex"], 2),
                "debt": round(buckets["debt"], 2),
                "cash_share_pct": round(cash_share * 100, 1),
                "investment_share_pct": round(investment_share * 100, 1),
                "gold_share_pct": round(gold_share * 100, 1),
                "forex_share_pct": round(forex_share * 100, 1),
            },
            "target": {
                "gold_share_pct": round(TARGET_GOLD_SHARE * 100, 1),
                "forex_share_pct": round(TARGET_FOREX_SHARE * 100, 1),
            },
            "health_score": score,
            "tips": tips,
            "disclaimer": t("portfolio.disclaimer", locale),
        }
