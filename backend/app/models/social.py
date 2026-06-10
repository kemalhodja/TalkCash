import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SharedWallet(Base):
    __tablename__ = "shared_wallets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(10), default="TRY")
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    member_ids: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DebtRecord(Base):
    __tablename__ = "debt_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    person_name: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    currency: Mapped[str] = mapped_column(String(10), default="TRY")
    is_lent: Mapped[bool] = mapped_column(default=True)
    is_settled: Mapped[bool] = mapped_column(default=False)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SplitBill(Base):
    __tablename__ = "split_bills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    person_count: Mapped[int] = mapped_column(default=2)
    per_person: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    share_message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
