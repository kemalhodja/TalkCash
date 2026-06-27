import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

os.environ.setdefault("SCHEDULER_ENABLED", "false")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from app.database import Base, get_db
from app.main import app

TEST_DB = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://talkcash:talkcash@localhost:5432/talkcash_test",
)

test_engine = create_async_engine(
    TEST_DB,
    echo=False,
    poolclass=NullPool,
    connect_args={"timeout": 3},
)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def setup_database():
    try:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        yield
    except Exception as e:
        pytest.skip(f"PostgreSQL not available for E2E: {e}")


async def _override_get_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


@pytest_asyncio.fixture(autouse=True)
async def _reset_redis_pool():
    yield
    from app.utils.redis_client import close_redis

    await close_redis()


@pytest_asyncio.fixture
async def client(setup_database):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient):
    email = f"test_{uuid.uuid4().hex[:8]}@talkcash.io"
    resp = await client.post("/api/v1/auth/register", json={
        "email": email, "password": "testpass123", "full_name": "Test User",
    })
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    wallets = await client.get("/api/v1/wallets/", headers=headers)
    assert wallets.status_code == 200, wallets.text
    for wallet in wallets.json():
        if wallet["wallet_type"] in ("credit_card",):
            continue
        fund = await client.post(
            f"/api/v1/wallets/income?wallet_id={wallet['id']}&amount=100000&description=test_seed",
            headers=headers,
        )
        assert fund.status_code == 200, fund.text
    return headers
