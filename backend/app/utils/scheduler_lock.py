import logging

from app.utils.redis_client import get_redis

logger = logging.getLogger(__name__)
_LOCK_KEY = "talkcash:scheduler:leader"
_LOCK_TTL = 120


async def acquire_scheduler_leader() -> bool:
    """Only one API instance should run cron jobs."""
    try:
        redis = await get_redis()
        acquired = await redis.set(_LOCK_KEY, "1", nx=True, ex=_LOCK_TTL)
        return bool(acquired)
    except Exception as exc:
        logger.warning("Scheduler leader lock unavailable (%s) — running jobs locally", exc)
        return True


async def refresh_scheduler_leader() -> bool:
    try:
        redis = await get_redis()
        return bool(await redis.expire(_LOCK_KEY, _LOCK_TTL))
    except Exception:
        return True
