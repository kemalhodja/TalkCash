"""Sesli komutlarda çoklu para birimi dönüşümü."""

from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.wallet import Wallet
from app.schemas.common import ParsedInput
from app.services.exchange.service import ExchangeService

_exchange = ExchangeService()


async def resolve_amount_for_wallet(
    db: AsyncSession,
    parsed: ParsedInput,
    wallet: Wallet,
    locale: str = "tr",
) -> tuple[Decimal, ParsedInput, dict | None]:
    """
    Kaynak para birimindeki tutarı cüzdan para birimine çevirir.
    Dönüşüm yapıldıysa meta bilgi döner.
    """
    if not parsed.amount:
        return parsed.amount, parsed, None

    source = (parsed.currency or "TRY").upper()
    target = (wallet.currency or "TRY").upper()
    if source == target:
        return parsed.amount, parsed, None

    converted = await _exchange.convert(
        db,
        parsed.amount,
        source,
        target,
        wallet_type=wallet.wallet_type.value if wallet.wallet_type else None,
    )
    rate = await _exchange.get_rate(db, source) if target == "TRY" else None
    if target != "TRY" and source != "TRY":
        try_equiv = await _exchange.convert_to_try(db, parsed.amount, source)
        rate = (try_equiv / parsed.amount).quantize(Decimal("0.0001")) if parsed.amount else None

    updated = parsed.model_copy(update={
        "original_amount": parsed.amount,
        "original_currency": source,
        "amount": converted,
        "currency": target,
        "fx_rate": rate,
    })
    fx_note = t(
        "execute.fx_converted",
        locale,
        original=float(parsed.amount),
        from_cur=source,
        converted=float(converted),
        to_cur=target,
    )
    return converted, updated, {"fx_conversion": fx_note, "original_amount": float(parsed.amount), "original_currency": source}
