"""Redis-backed sliding-window rate limiter."""

from fastapi import HTTPException, Request

from app.config import settings
from app.utils.redis_client import get_redis


async def check_rate_limit(request: Request, bucket: str, limit: int, window_seconds: int = 60) -> None:
    if not settings.rate_limit_enabled:
        return

    client_ip = request.client.host if request.client else "unknown"
    key = f"rl:{bucket}:{client_ip}"

    try:
        redis = await get_redis()
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
        if count > limit:
            raise HTTPException(status_code=429, detail="auth.rate_limited")
    except HTTPException:
        raise
    except Exception:
        # Redis unavailable — allow request rather than blocking all traffic
        return
