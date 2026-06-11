import enum
from collections.abc import AsyncGenerator

from sqlalchemy import Enum
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def pg_enum(enum_class: type[enum.Enum], **kwargs) -> Enum:
    """PostgreSQL enum columns store Python enum values, not member names."""
    return Enum(enum_class, values_callable=lambda x: [e.value for e in x], **kwargs)

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
