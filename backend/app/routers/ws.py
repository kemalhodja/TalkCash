from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import async_session
from app.services.social.shared_wallet_service import SharedWalletService, wallet_manager
from app.utils.security import decode_token
from app.utils.validation import clamp_text, parse_positive_amount

router = APIRouter(tags=["WebSocket"])
shared_service = SharedWalletService()


@router.websocket("/ws/shared-wallet/{wallet_id}")
async def shared_wallet_ws(websocket: WebSocket, wallet_id: str):
    await websocket.accept()
    user_id: UUID | None = None

    try:
        auth_msg = await websocket.receive_json()
        if auth_msg.get("action") != "auth":
            await websocket.close(code=4001)
            return
        token = auth_msg.get("token", "")
        decoded = decode_token(token)
        if not decoded:
            await websocket.close(code=4001)
            return
        user_id = decoded

        async with async_session() as db:
            if not await shared_service.is_member(db, UUID(wallet_id), user_id):
                await websocket.close(code=4003)
                return

        await websocket.send_json({"type": "auth_ok"})
        await wallet_manager.connect(wallet_id, websocket)

        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "expense":
                try:
                    amount = parse_positive_amount(data.get("amount"))
                    description = clamp_text(data.get("description"))
                    user_name = clamp_text(data.get("user_name", "User"), max_len=100)
                except ValueError:
                    await websocket.send_json({"type": "error", "message": "invalid_expense"})
                    continue
                async with async_session() as db:
                    await shared_service.add_expense(
                        db, UUID(wallet_id),
                        amount=amount,
                        description=description,
                        user_name=user_name,
                        user_id=user_id,
                    )
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        if user_id is not None:
            wallet_manager.disconnect(wallet_id, websocket)
