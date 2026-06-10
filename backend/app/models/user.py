import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255), default="")
    pin_code: Mapped[str | None] = mapped_column(String(255), nullable=True)
    biometric_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    push_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    locale: Mapped[str] = mapped_column(String(5), default="tr")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    wallets = relationship("Wallet", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user")
    agenda_items = relationship("AgendaItem", back_populates="user")
    shopping_items = relationship("ShoppingItem", back_populates="user")
    budget_limits = relationship("BudgetLimit", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
