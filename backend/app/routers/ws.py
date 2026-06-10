import json
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.services.social.shared_wallet_service import SharedWalletService, wallet_manager

router = APIRouter(tags=["WebSocket"])
shared_service = SharedWalletService()


@router.websocket("/ws/shared-wallet/{wallet_id}")
async def shared_wallet_ws(websocket: WebSocket, wallet_id: str):
    await websocket.accept()
    await wallet_manager.connect(wallet_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "expense":
                async with async_session() as db:
                    wallet = await shared_service.add_expense(
                        db, UUID(wallet_id),
                        amount=data["amount"],
                        description=data.get("description", ""),
                        user_name=data.get("user_name", "Kullanıcı"),
                    )
                    await websocket.send_json({
                        "type": "expense_confirmed",
                        "balance": float(wallet.balance),
                    })
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        wallet_manager.disconnect(wallet_id, websocket)
