from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError, t
from app.schemas.common import ParsedInput
from app.services.agenda.service import AgendaService
from app.services.budget_notify import push_budget_alerts_after_expense
from app.services.micro_savings.service import MicroSavingsService
from app.services.product_price.service import ProductPriceService
from app.services.shopping.service import ShoppingService
from app.services.social.service import SocialService
from app.services.wallet.service import WalletService
from app.services.nlp.personas import is_luxury_spend, normalize_persona, persona_spend_speech
from app.services.nlp.turkish_parser import extract_store_name
from app.services.execute.fx import resolve_amount_for_wallet
from app.services.social.shared_wallet_service import SharedWalletService
from app.services.subscription.manager import SubscriptionManager, detect_subscription

wallet_service = WalletService()
agenda_service = AgendaService()
shopping_service = ShoppingService()
social_service = SocialService()
product_price_service = ProductPriceService()
micro_savings_service = MicroSavingsService()
subscription_manager = SubscriptionManager()
shared_wallet_service = SharedWalletService()


async def _sync_family_shared_wallet(
    db: AsyncSession,
    user_id: UUID,
    parsed: ParsedInput,
    amount,
    description: str,
    locale: str,
) -> dict | None:
    if not parsed.share_to_family:
        return None
    from app.models.user import User as UserModel
    from app.models.workspace import Organization, OrganizationMember, WorkspaceType

    user = await db.get(UserModel, user_id)
    if not user:
        return None
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(
            OrganizationMember.user_id == user_id,
            Organization.workspace_type == WorkspaceType.FAMILY,
            Organization.shared_wallet_id.isnot(None),
        )
        .order_by(Organization.created_at.asc())
    )
    org = result.scalars().first()
    if not org or not org.shared_wallet_id:
        return None
    await shared_wallet_service.add_expense(
        db,
        org.shared_wallet_id,
        amount,
        description or parsed.category or parsed.raw_text or "",
        user.full_name or user.email,
        user_id,
    )
    return {
        "shared_wallet_id": str(org.shared_wallet_id),
        "organization_name": org.name,
        "message": t("workspace.family_expense_synced", locale, name=org.name),
    }


def _resolve_store_name(parsed: ParsedInput, locale: str) -> str:
    for candidate in (parsed.store_name, parsed.place):
        if candidate and candidate.strip():
            return candidate.strip()
    from_raw = extract_store_name(parsed.raw_text or "")
    if from_raw:
        return from_raw
    return "Genel"


async def _expense_with_price_alert(
    db: AsyncSession,
    user_id: UUID,
    parsed: ParsedInput,
    tx,
    locale: str,
    user=None,
) -> dict:
    product = (parsed.description or parsed.category or parsed.raw_text or "").strip()
    alert = await product_price_service.record_and_compare(
        db,
        user_id,
        product,
        tx.store_name,
        parsed.amount,
        transaction_id=tx.id,
        locale=locale,
        user_name=user.full_name if user else None,
    )
    result: dict = {"transaction_id": str(tx.id), "amount": float(tx.amount), "store_name": tx.store_name}
    if alert:
        result["voice_alert"] = alert
    if user is None:
        from app.models.user import User as UserModel
        user = await db.get(UserModel, user_id)
    if user:
        extras = await micro_savings_service.process_post_expense(
            db, user, product, parsed.category or "Genel", parsed.amount, tx.wallet_id, locale,
        )
        result.update(extras)

        persona = normalize_persona(user.assistant_persona)
        budget_exceeded = False
        try:
            from app.services.ai_mentor.service import AIMentorService
            alerts = await AIMentorService().check_budget_alerts(db, user_id, locale)
            budget_exceeded = any(a.get("type") == "budget_exceeded" for a in alerts)
        except Exception:
            pass
        if is_luxury_spend(parsed.category, parsed.description, parsed.raw_text) or budget_exceeded:
            speech = persona_spend_speech(
                persona, locale,
                user_name=user.full_name,
                category=parsed.category or "Genel",
                amount=float(parsed.amount),
                budget_exceeded=budget_exceeded,
                description=parsed.description,
                raw_text=parsed.raw_text,
            )
            if speech:
                result["persona_speech"] = {"action": "trigger_voice_alert", "speech_text": speech}
    return result


async def dispatch_confirmed_action(
    user_id: UUID,
    parsed: ParsedInput,
    db: AsyncSession,
    locale: str = "tr",
) -> dict:
    intent = parsed.intent

    if intent == "manual_edit":
        parsed = parsed.model_copy(update={"intent": "add_expense"})
        intent = "add_expense"

    if intent == "easter_egg":
        return {"easter_egg": True, "message": parsed.description or t("nlp.easter_egg", locale)}

    if intent == "add_expense":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        wallet = await wallet_service.find_by_name(db, user_id, parsed.wallet_name or "Nakit")
        if not wallet:
            raise ValueError(t("wallet.not_found", locale))
        receipt_uuid = UUID(parsed.receipt_id) if parsed.receipt_id else None
        from app.services.nlp.turkish_parser import refine_expense_category
        category = refine_expense_category(
            parsed.raw_text or parsed.description or "",
            parsed.category or "Genel",
        )
        store_name = _resolve_store_name(parsed, locale)
        is_sub = parsed.is_subscription
        sub_name = parsed.subscription_name
        if not is_sub:
            is_sub, sub_name = detect_subscription(parsed.raw_text or parsed.description or "")

        expense_at = None
        if parsed.date and parsed.date <= datetime.utcnow():
            expense_at = parsed.date

        amount, parsed, fx_meta = await resolve_amount_for_wallet(db, parsed, wallet, locale)

        tx = await wallet_service.add_expense(
            db, user_id, wallet.id, amount, category,
            parsed.description or "", parsed.place or store_name,
            store_name=store_name, receipt_id=receipt_uuid,
            transaction_at=expense_at,
            currency=parsed.currency,
            notes=fx_meta.get("fx_conversion") if fx_meta else None,
            original_amount=parsed.original_amount,
            original_currency=parsed.original_currency,
            fx_rate=parsed.fx_rate,
        )

        sub_info = None
        if is_sub and sub_name:
            sub_info = await subscription_manager.attach_to_transaction(
                db, user_id, tx, parsed.amount, sub_name, locale,
            )

        await push_budget_alerts_after_expense(db, user_id, category, locale)
        from app.models.user import User as UserModel
        user = await db.get(UserModel, user_id)
        result = await _expense_with_price_alert(db, user_id, parsed, tx, locale, user=user)
        if fx_meta:
            result.update(fx_meta)
        family_sync = await _sync_family_shared_wallet(
            db, user_id, parsed, amount, parsed.description or category, locale,
        )
        if family_sync:
            result["family_sync"] = family_sync
        if sub_info:
            result["subscription"] = sub_info
            result["subscription_alert"] = {
                "action": "trigger_voice_alert",
                "speech_text": sub_info["speech_text"],
                "subscription_name": sub_info["subscription_name"],
                "next_billing_date": sub_info["next_billing_date"],
            }
        return result

    if intent == "add_income":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        wallet = await wallet_service.find_by_name(db, user_id, parsed.wallet_name or "Banka")
        if not wallet:
            raise ValueError(t("wallet.not_found", locale))
        amount, parsed, fx_meta = await resolve_amount_for_wallet(db, parsed, wallet, locale)
        tx = await wallet_service.add_income(
            db, user_id, wallet.id, amount, parsed.description or "", currency=parsed.currency,
        )
        result = {"wallet": wallet.name, "transaction_id": str(tx.id)}
        if fx_meta:
            result.update(fx_meta)
        return result

    if intent == "transfer":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        from_w = await wallet_service.find_by_name(db, user_id, parsed.wallet_name or "Banka")
        to_w = await wallet_service.find_by_name(db, user_id, parsed.target_wallet_name or "Nakit")
        if not from_w or not to_w:
            raise ValueError(t("wallet.not_found", locale))
        amount, parsed, fx_meta = await resolve_amount_for_wallet(db, parsed, from_w, locale)
        await wallet_service.transfer(db, user_id, from_w.id, to_w.id, amount)
        result = {"from": from_w.name, "to": to_w.name, "amount": float(amount)}
        if fx_meta:
            result.update(fx_meta)
        return result

    if intent == "add_shopping":
        items = parsed.items or ([parsed.description] if parsed.description else [])
        if not items:
            raise ValueError(t("execute.item_required", locale))
        created, suggestion = await shopping_service.add_items(
            db, user_id, items, locale=locale,
        )
        result: dict = {"added": [i.name for i in created]}
        if suggestion:
            result["suggestion"] = suggestion
        return result

    if intent == "mark_paid":
        wallet_id = None
        if parsed.wallet_name:
            w = await wallet_service.find_by_name(db, user_id, parsed.wallet_name)
            wallet_id = w.id if w else None
        item = await agenda_service.mark_paid(db, user_id, parsed.description or "", wallet_id)
        return {"title": item.title, "status": item.status.value}

    if intent == "add_bill":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        due = parsed.date or (datetime.utcnow() + timedelta(days=7))
        item = await agenda_service.add_bill(
            db, user_id, parsed.description or parsed.category or "Fatura",
            parsed.amount, due, is_recurring=parsed.is_recurring, force=parsed.force,
        )
        return {
            "id": str(item.id), "title": item.title,
            "due_date": item.due_date.isoformat(), "amount": float(item.amount),
        }

    if intent == "add_task":
        due = parsed.date or (datetime.utcnow() + timedelta(days=1))
        title = (parsed.description or parsed.raw_text or "Görev").strip()
        for prefix in ("yapılacak:", "yapilacak:", "görev:", "gorev:", "hatırlat:", "hatirlat:"):
            if title.lower().startswith(prefix):
                title = title[len(prefix):].strip()
                break
        item = await agenda_service.add_task(db, user_id, title, due, notes=parsed.raw_text or None)
        return {
            "id": str(item.id), "title": item.title,
            "item_type": "task", "due_date": item.due_date.isoformat(),
        }

    if intent == "add_installment":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        items = await agenda_service.create_installments(
            db, user_id, parsed.description or "Taksit",
            parsed.amount, parsed.installment_count or 6,
        )
        return {"installments": len(items), "per_month": float(items[0].amount)}

    if intent == "add_debt":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        is_lent = not any(
            phrase in (parsed.raw_text or "").lower()
            for phrase in ("aldım", "borç aldım", "borrowed", "i owe", "i borrowed")
        )
        record = await social_service.add_debt(db, user_id, parsed.person_name or "?", parsed.amount, is_lent)
        return {"person": record.person_name, "amount": float(record.amount)}

    if intent == "split_bill":
        if not parsed.amount:
            raise ValueError(t("execute.amount_required", locale))
        count = parsed.person_count or 2
        bill = await social_service.split_bill(db, user_id, parsed.amount, count)
        return {"per_person": float(bill.per_person), "message": bill.share_message}

    raise ValueError(t("execute.unsupported_intent", locale, intent=intent))
