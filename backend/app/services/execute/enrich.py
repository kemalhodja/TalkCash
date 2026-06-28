"""Parse sonrası FX önizleme ve aile paylaşım ipuçları."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.common import ParsedInput
from app.services.execute.fx import resolve_amount_for_wallet
from app.services.nlp.family_hints import detect_share_to_family
from app.services.wallet.service import WalletService

_wallet = WalletService()


async def enrich_parsed_expense(
    db: AsyncSession,
    user_id: UUID,
    parsed: ParsedInput,
    locale: str = "tr",
) -> tuple[ParsedInput, str | None]:
    """Cüzdan para birimine FX önizlemesi ve aile paylaşım bayrağı."""
    updated = parsed
    fx_line: str | None = None

    if parsed.intent in ("add_expense", "manual_edit", "add_income", "transfer") and parsed.amount:
        wallet_name = parsed.wallet_name or ("Nakit" if parsed.intent == "add_expense" else "Banka")
        wallet = await _wallet.find_by_name(db, user_id, wallet_name)
        if wallet:
            _, updated, fx_meta = await resolve_amount_for_wallet(db, parsed, wallet, locale)
            if fx_meta:
                fx_line = fx_meta.get("fx_conversion")

    if parsed.intent in ("add_expense", "manual_edit") and not updated.share_to_family:
        if detect_share_to_family(parsed.raw_text or parsed.description or ""):
            updated = updated.model_copy(update={"share_to_family": True})

    return updated, fx_line
