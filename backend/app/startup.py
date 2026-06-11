import logging

from app.config import settings

logger = logging.getLogger(__name__)

_WEAK_SECRETS = frozenset({"change-me-in-production", "dev-secret-key-local", "test-secret-key"})


def validate_production_settings() -> None:
    """Fail fast when production-like settings are insecure."""
    if settings.debug:
        return

    errors: list[str] = []
    if settings.secret_key in _WEAK_SECRETS or len(settings.secret_key) < 32:
        errors.append("SECRET_KEY must be a strong random string (32+ chars) when DEBUG=false")
    if settings.allowed_origins.strip() == "*":
        errors.append("ALLOWED_ORIGINS must list explicit domains when DEBUG=false")
    if not settings.s3_enabled:
        logger.warning("S3_ENABLED=false — receipt images will not persist across restarts")

    if errors:
        raise RuntimeError("Invalid production configuration:\n- " + "\n- ".join(errors))
