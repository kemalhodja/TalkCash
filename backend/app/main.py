import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import agenda, ai, auth, budgets, execute, export, input, notifications, ocr, shopping, social, transactions, wallets, ws
from app.tasks.scheduler import start_scheduler

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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
app.include_router(ws.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
