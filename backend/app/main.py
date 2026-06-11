import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.i18n import SUPPORTED_LOCALES, locale_from_request, maybe_translate, resolve_error, t
from app.routers import agenda, ai, auth, budgets, execute, export, geofence, input, notifications, ocr, shopping, social, sync, transactions, wallets, ws
from app.services.social.ws_bridge import start_redis_ws_bridge, stop_redis_ws_bridge
from app.startup import validate_production_settings
from app.tasks.scheduler import start_scheduler, stop_scheduler
from app.utils.redis_client import get_redis
from app.utils.scheduler_lock import acquire_scheduler_leader

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_production_settings()
    if not settings.debug and settings.secret_key in ("change-me-in-production", "dev-secret-key-local"):
        logging.warning("SECRET_KEY is using a default value — set a strong secret in production")
    scheduler_started = False
    if settings.scheduler_enabled and await acquire_scheduler_leader():
        start_scheduler()
        scheduler_started = True
    elif settings.scheduler_enabled:
        logging.info("Scheduler skipped — another instance holds the leader lock")
    start_redis_ws_bridge()
    yield
    if scheduler_started:
        stop_scheduler()
    await stop_redis_ws_bridge()


def _cors_origins() -> list[str]:
    raw = settings.allowed_origins.strip()
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title=settings.app_name,
    description="TalkCash — Sesli komut ve AI destekli kişisel finans yönetimi",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=settings.allowed_origins.strip() != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    lang = locale_from_request(request)
    detail = exc.detail
    if isinstance(detail, str):
        detail = maybe_translate(detail, lang)
    elif isinstance(detail, list):
        detail = [
            {**item, "msg": maybe_translate(item.get("msg", ""), lang)} if isinstance(item, dict) else item
            for item in detail
        ]
    return JSONResponse(status_code=exc.status_code, content={"detail": detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    lang = locale_from_request(request)
    detail = []
    for err in exc.errors():
        if isinstance(err, dict) and "msg" in err:
            detail.append({**err, "msg": maybe_translate(str(err["msg"]), lang)})
        else:
            detail.append(err)
    return JSONResponse(status_code=422, content={"detail": detail})


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    lang = locale_from_request(request)
    return JSONResponse(status_code=400, content={"detail": resolve_error(exc, lang)})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.exception("Unhandled error on %s", request.url.path)
    lang = locale_from_request(request)
    return JSONResponse(status_code=500, content={"detail": t("error.internal", lang)})


app.include_router(auth.router, prefix="/api/v1")
app.include_router(input.router, prefix="/api/v1")
app.include_router(wallets.router, prefix="/api/v1")
app.include_router(agenda.router, prefix="/api/v1")
app.include_router(shopping.router, prefix="/api/v1")
app.include_router(ocr.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(social.router, prefix="/api/v1")
app.include_router(execute.router, prefix="/api/v1")
app.include_router(budgets.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(geofence.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
app.include_router(ws.router, prefix="/api/v1")


@app.get("/health")
async def health(request: Request, db: AsyncSession = Depends(get_db)):
    lang = locale_from_request(request)
    checks: dict[str, bool] = {"database": False, "redis": False}
    if settings.s3_enabled:
        checks["storage"] = False

    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass

    try:
        redis = await get_redis()
        await redis.ping()
        checks["redis"] = True
    except Exception:
        pass

    if settings.s3_enabled:
        try:
            from app.services.storage.service import StorageService
            storage = StorageService()
            if storage._s3:
                import asyncio
                await asyncio.to_thread(storage._s3.head_bucket, Bucket=settings.s3_bucket)
                checks["storage"] = True
        except Exception:
            pass

    healthy = checks["database"]
    all_ok = all(checks.values())
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "ok" if all_ok else ("degraded" if healthy else "down"),
            "app": settings.app_name,
            "message": t("health.ok", lang),
            "locales": SUPPORTED_LOCALES,
            "checks": checks,
        },
    )


@app.get("/api/v1/i18n/{lang}")
async def get_translations(lang: str):
    from pathlib import Path
    import json
    path = Path(__file__).parent / "i18n" / "locales" / f"{lang}.json"
    if not path.exists():
        path = Path(__file__).parent / "i18n" / "locales" / "tr.json"
    return json.loads(path.read_text(encoding="utf-8"))
