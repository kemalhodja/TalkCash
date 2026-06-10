import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.i18n import SUPPORTED_LOCALES, locale_from_request, maybe_translate, resolve_error, t
from app.routers import agenda, ai, auth, budgets, execute, export, geofence, input, notifications, ocr, shopping, social, transactions, wallets, ws
from app.tasks.scheduler import start_scheduler

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


app = FastAPI(
    title=settings.app_name,
    description="TalkCash — Sesli komut ve AI destekli kişisel finans yönetimi",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    lang = locale_from_request(request)
    return JSONResponse(status_code=400, content={"detail": resolve_error(exc, lang)})


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
app.include_router(ws.router, prefix="/api/v1")


@app.get("/health")
async def health(request: Request):
    lang = locale_from_request(request)
    return {"status": "ok", "app": settings.app_name, "message": t("health.ok", lang), "locales": SUPPORTED_LOCALES}


@app.get("/api/v1/i18n/{lang}")
async def get_translations(lang: str):
    from pathlib import Path
    import json
    path = Path(__file__).parent / "i18n" / "locales" / f"{lang}.json"
    if not path.exists():
        path = Path(__file__).parent / "i18n" / "locales" / "tr.json"
    return json.loads(path.read_text(encoding="utf-8"))
