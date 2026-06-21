from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.exchange.service import ExchangeService


async def enrich_summary_with_live_rates(db: AsyncSession, summary: dict) -> dict:
    exchange = ExchangeService()
    xau = float(await exchange.get_rate(db, "XAU"))
    usd = float(await exchange.get_rate(db, "USD"))
    eur = float(await exchange.get_rate(db, "EUR"))

    balances = summary.get("investment_balances") or {}
    gold_try = float(balances.get("investment_gold", 0))
    forex_try = float(balances.get("investment_forex", 0))

    summary["live_rates"] = {
        "gold_try_per_gram": xau,
        "usd_try": usd,
        "eur_try": eur,
    }
    summary["equivalents"] = {
        "gold_grams": round(gold_try / xau, 4) if xau > 0 else 0.0,
        "forex_usd": round(forex_try / usd, 2) if usd > 0 else 0.0,
        "forex_eur": round(forex_try / eur, 2) if eur > 0 else 0.0,
    }
    return summary


def simulate_growth(
    monthly_contribution: float,
    months: int,
    starting_balance: float,
    annual_return: float = 0.08,
) -> dict:
    """Educational compound-growth simulation (not financial advice)."""
    months = max(1, min(months, 60))
    monthly_rate = annual_return / 12
    balance = starting_balance
    rows: list[dict] = []
    for month in range(1, months + 1):
        balance = balance * (1 + monthly_rate) + monthly_contribution
        rows.append({
            "month": month,
            "contribution": round(monthly_contribution, 2),
            "balance": round(balance, 2),
        })
    return {
        "starting_balance": round(starting_balance, 2),
        "monthly_contribution": round(monthly_contribution, 2),
        "months": months,
        "annual_return_assumption": annual_return,
        "final_balance": round(balance, 2),
        "timeline": rows,
        "disclaimer_key": "micro_savings.simulation_disclaimer",
    }


def try_to_gold_grams(amount_try: Decimal, gold_try_per_gram: float) -> float:
    if gold_try_per_gram <= 0:
        return 0.0
    return round(float(amount_try) / gold_try_per_gram, 4)
