from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.exchange_rate import ExchangeRate
from app.models.wallet import WalletType

GOLD_TRY_PER_GRAM = Decimal("2850")
DEFAULT_RATES = {
    "USD": Decimal("34.50"),
    "EUR": Decimal("37.20"),
    "GBP": Decimal("43.80"),
    "XAU": GOLD_TRY_PER_GRAM,
}


class ExchangeService:
    async def sync_rates(self, db: AsyncSession) -> dict[str, Decimal]:
        rates = await self._fetch_rates()
        for currency, rate in rates.items():
            existing = await db.execute(select(ExchangeRate).where(ExchangeRate.currency == currency))
            row = existing.scalars().first()
            if row:
                row.rate_to_try = rate
            else:
                db.add(ExchangeRate(currency=currency, rate_to_try=rate))
        await db.commit()
        return rates

    async def get_rate(self, db: AsyncSession, currency: str) -> Decimal:
        if currency == "TRY":
            return Decimal("1")
        result = await db.execute(select(ExchangeRate).where(ExchangeRate.currency == currency))
        row = result.scalars().first()
        return row.rate_to_try if row else DEFAULT_RATES.get(currency, Decimal("1"))

    async def convert_to_try(self, db: AsyncSession, amount: Decimal, currency: str, wallet_type: str | None = None) -> Decimal:
        if wallet_type == WalletType.INVESTMENT_GOLD.value:
            return amount * await self.get_rate(db, "XAU")
        if currency == "TRY":
            return amount
        rate = await self.get_rate(db, currency)
        return amount * rate

    async def _fetch_rates(self) -> dict[str, Decimal]:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(settings.exchange_rate_api)
                data = resp.json()
                base_rates = data.get("rates", {})
                return {
                    "USD": Decimal(str(1 / base_rates.get("USD", 0.029))),
                    "EUR": Decimal(str(1 / base_rates.get("EUR", 0.027))),
                    "GBP": Decimal(str(1 / base_rates.get("GBP", 0.023))),
                    "XAU": GOLD_TRY_PER_GRAM,
                }
        except Exception:
            return DEFAULT_RATES.copy()
