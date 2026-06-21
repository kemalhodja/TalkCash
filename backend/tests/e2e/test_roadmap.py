import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import Base, get_db
from app.main import app
from app.models.roadmap import RoadmapFeature, RoadmapStatus

TEST_DB = "postgresql+asyncpg://talkcash:talkcash@localhost:5432/talkcash_test"

test_engine = create_async_engine(TEST_DB, echo=False, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def setup_database():
    try:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        yield
    except Exception as e:
        pytest.skip(f"PostgreSQL not available: {e}")


async def _override_get_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


@pytest_asyncio.fixture
async def client(setup_database):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient):
    email = f"roadmap_{uuid.uuid4().hex[:8]}@talkcash.io"
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "testpass123", "full_name": "Roadmap User"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def backlog_feature_id(setup_database):
    async with TestSession() as db:
        feature = RoadmapFeature(
            title_tr="Test backlog",
            title_en="Test backlog",
            description_tr="Açıklama",
            description_en="Description",
            status=RoadmapStatus.BACKLOG,
            sort_order=1,
        )
        db.add(feature)
        await db.commit()
        await db.refresh(feature)
        return feature.id


@pytest.mark.asyncio
async def test_list_roadmap_seeds_and_groups(client, auth_headers):
    resp = await client.get("/api/v1/roadmap", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "active" in body and "soon" in body and "backlog" in body
    assert len(body["active"]) >= 1
    assert all("is_voted" in item for section in body.values() for item in section)


@pytest.mark.asyncio
async def test_vote_backlog_feature(client, auth_headers, backlog_feature_id):
    vote = await client.post(f"/api/v1/roadmap/{backlog_feature_id}/vote", headers=auth_headers)
    assert vote.status_code == 200
    assert vote.json()["vote_count"] == 1
    assert vote.json()["is_voted"] is True

    duplicate = await client.post(f"/api/v1/roadmap/{backlog_feature_id}/vote", headers=auth_headers)
    assert duplicate.status_code == 400


@pytest.mark.asyncio
async def test_vote_active_feature_rejected(client, auth_headers):
    listed = await client.get("/api/v1/roadmap", headers=auth_headers)
    active_id = listed.json()["active"][0]["id"]
    resp = await client.post(f"/api/v1/roadmap/{active_id}/vote", headers=auth_headers)
    assert resp.status_code == 400
