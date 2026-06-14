import json
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import t
from app.models.receipt import Receipt
from app.models.shopping import ShoppingItem
from app.models.sync_operation import SyncOperationRecord
from app.models.transaction import Transaction
from app.routers.execute import _dispatch
from app.schemas.common import ParsedInput
from app.schemas.sync import SyncConflict, SyncOperation, SyncPushResponse, SyncPullResponse
from app.schemas.wallet import TransferRequest, WalletCreate, WalletUpdate
from app.models.wallet import WalletType
from app.services.budget.service import BudgetService
from app.services.agenda.service import AgendaService
from app.services.shopping.service import ShoppingService
from app.services.storage.service import StorageService
from app.services.wallet.service import WalletService
from app.schemas.transaction import TransactionUpdate
from app.services.transaction.service import TransactionService
from app.utils.redis_client import get_redis

shopping_service = ShoppingService()
agenda_service = AgendaService()
wallet_service = WalletService()
transaction_service = TransactionService()
storage_service = StorageService()
budget_service = BudgetService()

_ID_FIELDS = ("wallet_id", "from_wallet_id", "to_wallet_id", "item_id", "transaction_id", "budget_id")


def _remap_payload(payload: dict, id_map: dict[str, str]) -> dict:
    remapped = dict(payload)
    for field in _ID_FIELDS:
        val = remapped.get(field)
        if isinstance(val, str) and val in id_map:
            remapped[field] = id_map[val]
    return remapped


def _register_batch_remap(op: SyncOperation, result: dict, id_map: dict[str, str]) -> None:
    if op.type == "wallet_create" and op.payload.get("client_wallet_id") and result.get("wallet_id"):
        id_map[str(op.payload["client_wallet_id"])] = str(result["wallet_id"])
    if op.type == "agenda_add_bill" and op.payload.get("client_item_id") and result.get("id"):
        id_map[str(op.payload["client_item_id"])] = str(result["id"])
    if op.type == "budget_create" and op.payload.get("client_budget_id") and result.get("budget_id"):
        id_map[str(op.payload["client_budget_id"])] = str(result["budget_id"])
    if op.type == "shopping_add":
        client_ids = op.payload.get("client_item_ids") or []
        added = result.get("added") or []
        for i, client_id in enumerate(client_ids):
            if i < len(added) and isinstance(added[i], dict) and added[i].get("id"):
                id_map[str(client_id)] = str(added[i]["id"])


class SyncService:
    async def push(self, db: AsyncSession, user_id: UUID, operations: list[SyncOperation], locale: str = "tr") -> SyncPushResponse:
        applied: list[dict] = []
        conflicts: list[SyncConflict] = []
        failed: list[dict] = []

        batch_id_map: dict[str, str] = {}

        for op in operations:
            remapped_payload = _remap_payload(op.payload, batch_id_map)
            op = op.model_copy(update={"payload": remapped_payload})

            cached = await self._get_cached_result(db, user_id, op.id)
            if cached:
                applied.append({"operation_id": str(op.id), "status": "duplicate", "result": cached})
                continue

            try:
                result, conflict = await self._process_operation(db, user_id, op, locale)
                if conflict:
                    conflicts.append(conflict)
                else:
                    applied.append({"operation_id": str(op.id), "status": "ok", "result": result})
                    await self._cache_result(db, user_id, op.id, result)
                    if result:
                        _register_batch_remap(op, result, batch_id_map)
            except Exception as exc:
                failed.append({"operation_id": str(op.id), "error": str(exc)})

        return SyncPushResponse(applied=applied, conflicts=conflicts, failed=failed)

    async def pull(self, db: AsyncSession, user_id: UUID) -> SyncPullResponse:
        shopping = await shopping_service.list_active(db, user_id)
        agenda = await agenda_service.list_upcoming(db, user_id, days=60)
        agenda_history = await agenda_service.list_paid(db, user_id, limit=50)
        nw = await wallet_service.get_net_worth(db, user_id)
        budget_rows = await budget_service.list_with_usage(db, user_id)

        tx_result = await db.execute(
            select(Transaction).where(Transaction.user_id == user_id)
            .order_by(Transaction.created_at.desc()).limit(100)
        )
        transactions = [
            {
                "id": str(tx.id), "amount": float(tx.amount), "currency": tx.currency,
                "category": tx.category, "description": tx.description, "place": tx.place,
                "type": tx.transaction_type.value, "wallet_id": str(tx.wallet_id),
                "date": tx.created_at.isoformat(),
                "receipt_id": str(tx.receipt_id) if tx.receipt_id else None,
            }
            for tx in tx_result.scalars().all()
        ]

        rc_result = await db.execute(
            select(Receipt).where(Receipt.user_id == user_id)
            .order_by(Receipt.created_at.desc()).limit(50)
        )
        receipts = []
        for r in rc_result.scalars().all():
            url = await storage_service.get_url(r.image_url)
            receipts.append({
                "id": str(r.id), "total_amount": float(r.total_amount) if r.total_amount else None,
                "merchant": r.merchant, "verified": r.is_verified,
                "date": r.receipt_date.isoformat() if r.receipt_date else None,
                "image_url": url,
            })

        return SyncPullResponse(
            shopping=[
                {
                    "id": str(i.id), "name": i.name, "category": i.category.value,
                    "is_completed": i.is_completed,
                    "completed_at": i.completed_at.isoformat() if i.completed_at else None,
                }
                for i in shopping
            ],
            agenda=[
                {
                    "id": str(i.id), "title": i.title, "amount": float(i.amount),
                    "due_date": i.due_date.isoformat(), "status": i.status.value,
                    "paid_at": i.paid_at.isoformat() if i.paid_at else None,
                    "is_recurring": i.is_recurring,
                }
                for i in agenda
            ],
            agenda_history=[
                {
                    "id": str(i.id), "title": i.title, "amount": float(i.amount),
                    "due_date": i.due_date.isoformat(), "status": i.status.value,
                    "paid_at": i.paid_at.isoformat() if i.paid_at else None,
                }
                for i in agenda_history
            ],
            wallets=[
                {
                    "id": str(w.id), "name": w.name, "balance": float(w.balance),
                    "currency": w.currency, "wallet_type": w.wallet_type.value,
                    "balance_try": float(w.balance_try),
                }
                for w in nw.wallets
            ],
            net_worth_total=float(nw.total_try),
            budgets=[
                {
                    "id": str(b["id"]),
                    "category": b["category"],
                    "monthly_limit": float(b["monthly_limit"]),
                    "spent": float(b["spent"]),
                    "percent": b["percent"],
                    "currency": b.get("currency", "TRY"),
                }
                for b in budget_rows
            ],
            transactions=transactions,
            receipts=receipts,
            server_timestamp=datetime.utcnow(),
        )

    async def _process_operation(
        self, db: AsyncSession, user_id: UUID, op: SyncOperation, locale: str,
    ) -> tuple[dict | None, SyncConflict | None]:
        if op.type == "execute":
            parsed = ParsedInput(**op.payload.get("parsed", {}))
            result = await _dispatch(user_id, parsed, db, locale)
            return result, None

        if op.type == "wallet_income":
            wallet_id = UUID(op.payload["wallet_id"])
            amount = Decimal(str(op.payload["amount"]))
            tx = await wallet_service.add_income(
                db, user_id, wallet_id, amount,
                op.payload.get("description", ""), input_method="sync",
            )
            return {"transaction_id": str(tx.id)}, None

        if op.type == "wallet_transfer":
            req = TransferRequest(
                from_wallet_id=UUID(op.payload["from_wallet_id"]),
                to_wallet_id=UUID(op.payload["to_wallet_id"]),
                amount=Decimal(str(op.payload["amount"])),
                description=op.payload.get("description", ""),
            )
            from_w, to_w = await wallet_service.transfer(
                db, user_id, req.from_wallet_id, req.to_wallet_id, req.amount, req.description,
            )
            return {"from": from_w.name, "to": to_w.name}, None

        if op.type == "wallet_expense":
            wallet_id = UUID(op.payload["wallet_id"])
            amount = Decimal(str(op.payload["amount"]))
            tx = await wallet_service.add_expense(
                db, user_id, wallet_id, amount,
                op.payload.get("category", "Genel"),
                op.payload.get("description", ""),
                input_method="sync",
                receipt_id=UUID(op.payload["receipt_id"]) if op.payload.get("receipt_id") else None,
            )
            return {"transaction_id": str(tx.id)}, None

        if op.type == "shopping_add":
            items = op.payload.get("items", [])
            created = await shopping_service.add_items(db, user_id, items)
            return {"added": [{"id": str(i.id), "name": i.name} for i in created]}, None

        if op.type == "shopping_complete":
            item_id = UUID(op.payload["item_id"])
            item = await db.get(ShoppingItem, item_id)
            if not item or item.user_id != user_id:
                raise ValueError(t("shopping.item_not_found", locale))

            if item.is_completed:
                server_ts = item.completed_at or item.created_at
                if server_ts > op.client_timestamp.replace(tzinfo=None):
                    if op.resolve_strategy == "local":
                        return {"status": "kept_server"}, None
                    if op.resolve_strategy == "server":
                        return {
                            "id": str(item.id), "name": item.name,
                            "completed_at": server_ts.isoformat(),
                        }, None
                    return None, SyncConflict(
                        operation_id=op.id,
                        type="shopping_complete",
                        field="is_completed",
                        local=op.payload,
                        server={"id": str(item.id), "name": item.name, "completed_at": server_ts.isoformat()},
                        message=t("sync.conflict_shopping", locale, name=item.name),
                    )

            price = Decimal(str(op.payload["price"])) if op.payload.get("price") else None
            wallet_id = UUID(op.payload["wallet_id"]) if op.payload.get("wallet_id") else None
            completed = await shopping_service.complete_item(db, user_id, item_id, price, wallet_id)
            return {"id": str(completed.id), "name": completed.name}, None

        if op.type == "transaction_update":
            tx_id = UUID(op.payload["transaction_id"])
            data = TransactionUpdate(
                amount=Decimal(str(op.payload["amount"])) if op.payload.get("amount") is not None else None,
                category=op.payload.get("category"),
                description=op.payload.get("description"),
                place=op.payload.get("place"),
            )
            tx = await transaction_service.update(db, user_id, tx_id, data)
            return {"transaction_id": str(tx.id)}, None

        if op.type == "transaction_delete":
            tx_id = UUID(op.payload["transaction_id"])
            await transaction_service.delete(db, user_id, tx_id)
            return {"deleted": True}, None

        if op.type == "wallet_create":
            data = WalletCreate(
                name=op.payload["name"],
                wallet_type=WalletType(op.payload.get("wallet_type", "cash")),
                currency=op.payload.get("currency", "TRY"),
            )
            w = await wallet_service.create_wallet(db, user_id, data)
            return {"wallet_id": str(w.id), "name": w.name}, None

        if op.type == "wallet_update":
            wallet_id = UUID(op.payload["wallet_id"])
            data = WalletUpdate(
                name=op.payload.get("name"),
                wallet_type=WalletType(op.payload["wallet_type"]) if op.payload.get("wallet_type") else None,
                currency=op.payload.get("currency"),
            )
            w = await wallet_service.update_wallet(db, user_id, wallet_id, data)
            return {"wallet_id": str(w.id)}, None

        if op.type == "wallet_delete":
            await wallet_service.deactivate_wallet(db, user_id, UUID(op.payload["wallet_id"]))
            return {"deleted": True}, None

        if op.type == "agenda_add_bill":
            due = datetime.fromisoformat(op.payload["due_date"].replace("Z", ""))
            item = await agenda_service.add_bill(
                db, user_id, op.payload["title"], Decimal(str(op.payload["amount"])),
                due, op.payload.get("is_recurring", False), op.payload.get("force", False),
            )
            return {"id": str(item.id), "title": item.title}, None

        if op.type == "agenda_update":
            item = await agenda_service.update_item(
                db, user_id, UUID(op.payload["item_id"]),
                title=op.payload.get("title"),
                amount=Decimal(str(op.payload["amount"])) if op.payload.get("amount") is not None else None,
                due_date=datetime.fromisoformat(op.payload["due_date"].replace("Z", "")) if op.payload.get("due_date") else None,
                is_recurring=op.payload.get("is_recurring"),
            )
            return {"id": str(item.id)}, None

        if op.type == "agenda_delete":
            await agenda_service.delete_item(db, user_id, UUID(op.payload["item_id"]))
            return {"deleted": True}, None

        if op.type == "agenda_mark_paid":
            wallet_id = UUID(op.payload["wallet_id"]) if op.payload.get("wallet_id") else None
            item = await agenda_service.mark_paid(db, user_id, op.payload["title"], wallet_id)
            return {"id": str(item.id), "title": item.title}, None

        if op.type == "budget_create":
            budget = await budget_service.create(
                db, user_id, op.payload["category"], Decimal(str(op.payload["monthly_limit"])),
            )
            return {"budget_id": str(budget.id), "category": budget.category}, None

        if op.type == "budget_update":
            budget = await budget_service.update(
                db, UUID(op.payload["budget_id"]), user_id, Decimal(str(op.payload["monthly_limit"])),
            )
            return {"budget_id": str(budget.id)}, None

        if op.type == "budget_delete":
            await budget_service.delete(db, UUID(op.payload["budget_id"]), user_id)
            return {"deleted": True}, None

        raise ValueError(t("sync.unsupported_type", locale, type=op.type))

    async def _get_cached_result(self, db: AsyncSession, user_id: UUID, op_id: UUID) -> dict | None:
        row = await db.execute(
            select(SyncOperationRecord).where(
                SyncOperationRecord.user_id == user_id,
                SyncOperationRecord.operation_id == op_id,
            )
        )
        record = row.scalar_one_or_none()
        if record:
            return json.loads(record.result_json)
        try:
            r = await get_redis()
            val = await r.get(f"sync:{user_id}:{op_id}")
            return json.loads(val) if val else None
        except Exception:
            return None

    async def _cache_result(self, db: AsyncSession, user_id: UUID, op_id: UUID, result: dict) -> None:
        db.add(SyncOperationRecord(
            user_id=user_id,
            operation_id=op_id,
            result_json=json.dumps(result, default=str),
        ))
        await db.flush()
        try:
            r = await get_redis()
            await r.set(f"sync:{user_id}:{op_id}", json.dumps(result, default=str), ex=604800)
        except Exception:
            pass
