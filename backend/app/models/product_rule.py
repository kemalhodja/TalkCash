import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserProductRule(Base):
    __tablename__ = "user_product_rules"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", "suggested_product_id", name="uq_user_product_rule"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(String(255))
    suggested_product_id: Mapped[str] = mapped_column(String(255))
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    context_time_bucket: Mapped[str | None] = mapped_column(String(20), nullable=True)
    context_day_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    trigger_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    suggested_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="product_rules")


class ShoppingSuggestionLog(Base):
    __tablename__ = "shopping_suggestion_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    suggested_item: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="suggestion_logs")
