import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, pg_enum


class AgendaStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"


class AgendaItemType(str, enum.Enum):
    BILL = "bill"
    TASK = "task"


class AgendaItem(Base):
    __tablename__ = "agenda_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255))
    item_type: Mapped[str] = mapped_column(String(16), default=AgendaItemType.BILL.value)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="TRY")
    due_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[AgendaStatus] = mapped_column(pg_enum(AgendaStatus), default=AgendaStatus.PENDING)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurrence_months: Mapped[int] = mapped_column(Integer, default=1)
    installment_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    installment_current: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("agenda_items.id"), nullable=True)
    wallet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("wallets.id"), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="agenda_items")
