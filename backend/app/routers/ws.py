from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.database import async_session
from app.services.social.shared_wallet_service import SharedWalletService, wallet_manager
from app.utils.security import decode_token

router = APIRouter(tags=["WebSocket"])
shared_service = SharedWalletService()


@router.websocket("/ws/shared-wallet/{wallet_id}")
async def shared_wallet_ws(websocket: WebSocket, wallet_id: str, token: str = Query(...)):
    user_id = decode_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    async with async_session() as db:
        if not await shared_service.is_member(db, UUID(wallet_id), UUID(user_id)):
            await websocket.close(code=4003)
            return

    await websocket.accept()
    await wallet_manager.connect(wallet_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "expense":
                async with async_session() as db:
                    await shared_service.add_expense(
                        db, UUID(wallet_id),
                        amount=data["amount"],
                        description=data.get("description", ""),
                        user_name=data.get("user_name", "User"),
                        user_id=UUID(user_id),
                    )
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        wallet_manager.disconnect(wallet_id, websocket)
