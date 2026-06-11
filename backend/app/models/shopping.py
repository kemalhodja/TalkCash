import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, pg_enum


class ShoppingCategory(str, enum.Enum):
    BUTCHER = "sarkuteri"
    GREENS = "manav"
    DAIRY = "sut_urunleri"
    CLEANING = "temizlik"
    BAKERY = "firin"
    BEVERAGE = "icecek"
    OTHER = "diger"


class ShoppingItem(Base):
    __tablename__ = "shopping_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[ShoppingCategory] = mapped_column(pg_enum(ShoppingCategory), default=ShoppingCategory.OTHER)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_routine: Mapped[bool] = mapped_column(Boolean, default=False)
    routine_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user = relationship("User", back_populates="shopping_items")
