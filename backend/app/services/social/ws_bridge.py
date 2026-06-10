import asyncio
import json
import logging

from app.services.social.shared_wallet_service import wallet_manager
from app.utils.redis_client import get_redis

logger = logging.getLogger(__name__)

_bridge_task: asyncio.Task | None = None


async def _redis_ws_listener() -> None:
    """Subscribe to shared-wallet Redis channels and broadcast to local WebSocket clients."""
    try:
        redis = await get_redis()
        pubsub = redis.pubsub()
        await pubsub.psubscribe("shared_wallet:*")
        logger.info("Redis WS bridge listening on shared_wallet:*")
        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            channel = message["channel"]
            wallet_id = channel.split(":", 1)[-1] if ":" in channel else channel
            try:
                payload = json.loads(message["data"])
            except (json.JSONDecodeError, TypeError):
                continue
            await wallet_manager.broadcast(wallet_id, payload)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.warning("Redis WS bridge stopped: %s", exc)


def start_redis_ws_bridge() -> None:
    global _bridge_task
    if _bridge_task is None or _bridge_task.done():
        _bridge_task = asyncio.create_task(_redis_ws_listener())


async def stop_redis_ws_bridge() -> None:
    global _bridge_task
    if _bridge_task and not _bridge_task.done():
        _bridge_task.cancel()
        try:
            await _bridge_task
        except asyncio.CancelledError:
            pass
    _bridge_task = None
