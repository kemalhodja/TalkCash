"""Runtime observability helpers."""

from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)

APP_STARTED_AT = time.monotonic()
SLOW_REQUEST_MS = 2000


def uptime_seconds() -> int:
    return int(time.monotonic() - APP_STARTED_AT)


def log_slow_request(path: str, method: str, duration_ms: float, request_id: str) -> None:
    if duration_ms < SLOW_REQUEST_MS:
        return
    logger.warning(
        "slow_request path=%s method=%s duration_ms=%.1f request_id=%s",
        path,
        method,
        duration_ms,
        request_id,
    )


def capture_exception_with_request(exc: Exception, *, request_id: str, path: str) -> None:
    try:
        import sentry_sdk

        with sentry_sdk.push_scope() as scope:
            scope.set_tag("request_id", request_id)
            scope.set_tag("path", path)
            sentry_sdk.capture_exception(exc)
    except Exception:
        logger.debug("Sentry capture skipped", exc_info=True)
