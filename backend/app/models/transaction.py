import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, pg_enum


class TransactionType(str, enum.Enum):
    EXPENSE = "expense"
    INCOME = "income"
    TRANSFER = "transfer"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    wallet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("wallets.id"))
    target_wallet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("wallets.id"), nullable=True)
    transaction_type: Mapped[TransactionType] = mapped_column(pg_enum(TransactionType))
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    currency: Mapped[str] = mapped_column(String(10), default="TRY")
    category: Mapped[str] = mapped_column(String(100), default="Genel")
    description: Mapped[str] = mapped_column(String(255), default="")
    place: Mapped[str] = mapped_column(String(255), default="")
    store_name: Mapped[str] = mapped_column(String(255), default="")
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    next_billing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subscription_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    input_method: Mapped[str] = mapped_column(String(50), default="manual")
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("receipts.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    original_currency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    fx_rate: Mapped[Decimal | None] = mapped_column(Numeric(15, 6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="transactions")
    wallet = relationship("Wallet", back_populates="transactions", foreign_keys=[wallet_id])
    receipt = relationship("Receipt", back_populates="transaction")
