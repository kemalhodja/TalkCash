"""Redis-backed sliding-window rate limiter with in-memory fallback."""

import time

from fastapi import HTTPException, Request

from app.config import settings
from app.utils.redis_client import get_redis

_memory_windows: dict[str, tuple[int, float]] = {}


def _memory_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    count, window_start = _memory_windows.get(key, (0, now))
    if now - window_start >= window_seconds:
        count, window_start = 0, now
    count += 1
    _memory_windows[key] = (count, window_start)
    if count > limit:
        raise HTTPException(status_code=429, detail="error.rate_limited")


async def check_rate_limit(
    request: Request,
    bucket: str,
    limit: int,
    window_seconds: int = 60,
    identifier: str | None = None,
    *,
    strict: bool = False,
) -> None:
    if not settings.rate_limit_enabled:
        return

    client_ip = request.client.host if request.client else "unknown"
    subject = identifier or client_ip
    key = f"rl:{bucket}:{subject}"

    try:
        redis = await get_redis()
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
        if count > limit:
            raise HTTPException(status_code=429, detail="error.rate_limited")
    except HTTPException:
        raise
    except Exception:
        if strict:
            _memory_rate_limit(key, limit, window_seconds)
        return
