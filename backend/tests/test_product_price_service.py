from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import Base
from app.models.user import User
from app.services.product_price.helpers import first_name, price_diff_percent
from app.services.product_price.service import ProductPriceService

TEST_DB = "postgresql+asyncpg://talkcash:talkcash@localhost:5432/talkcash_test"

test_engine = create_async_engine(TEST_DB, echo=False, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session():
    try:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        async with TestSession() as session:
            user = User(email="soda@test.io", hashed_password="x", full_name="Ahmet Yılmaz")
            session.add(user)
            await session.commit()
            await session.refresh(user)
            yield session, user
    except Exception as e:
        pytest.skip(f"PostgreSQL not available: {e}")


def test_first_name_helper():
    assert first_name("Ahmet Yılmaz") == "Ahmet"
    assert first_name("") == ""


def test_price_diff_percent_soda_scenario():
    assert price_diff_percent(15.0, 10.0) == 50


@pytest.mark.asyncio
async def test_soda_migros_then_carrefour_voice_alert(db_session):
    db, user = db_session
    service = ProductPriceService()

    await service.record_and_compare(
        db, user.id, "soda", "Migros", Decimal("10.00"), locale="tr", user_name=user.full_name,
    )

    alert = await service.record_and_compare(
        db, user.id, "soda", "Carrefour", Decimal("15.00"), locale="tr", user_name=user.full_name,
    )

    assert alert is not None
    assert alert["action"] == "trigger_voice_alert"
    assert alert["current_store"] == "Carrefour"
    assert alert["previous_store"] == "Migros"
    assert alert["current_price"] == 15.0
    assert alert["previous_price"] == 10.0
    assert alert["percent_diff"] == 50
    assert "Ahmet" in alert["speech_text"]
    assert "Migros" in alert["speech_text"]
    assert "%50" in alert["speech_text"]


@pytest.mark.asyncio
async def test_same_store_no_alert(db_session):
    db, user = db_session
    service = ProductPriceService()

    await service.record_and_compare(db, user.id, "süt", "Migros", Decimal("10.00"))
    alert = await service.record_and_compare(db, user.id, "süt", "Migros", Decimal("15.00"))
    assert alert is None


@pytest.mark.asyncio
async def test_small_diff_below_threshold(db_session):
    db, user = db_session
    service = ProductPriceService()

    await service.record_and_compare(db, user.id, "ekmek", "Bim", Decimal("10.00"))
    alert = await service.record_and_compare(db, user.id, "ekmek", "Şok", Decimal("10.40"))
    assert alert is None
