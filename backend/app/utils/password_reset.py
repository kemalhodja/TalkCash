import hashlib
import secrets
from uuid import UUID

from app.config import settings
from app.utils.redis_client import get_redis

_RESET_PREFIX = "pwd_reset:"


def _token_key(raw_token: str) -> str:
    digest = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return f"{_RESET_PREFIX}{digest}"


def create_reset_token() -> str:
    return secrets.token_urlsafe(32)


async def store_reset_token(user_id: UUID, raw_token: str) -> None:
    redis = await get_redis()
    await redis.set(
        _token_key(raw_token),
        str(user_id),
        ex=settings.password_reset_ttl_seconds,
    )


async def consume_reset_token(raw_token: str) -> UUID | None:
    redis = await get_redis()
    key = _token_key(raw_token)
    user_id = await redis.get(key)
    if not user_id:
        return None
    await redis.delete(key)
    return UUID(user_id)
