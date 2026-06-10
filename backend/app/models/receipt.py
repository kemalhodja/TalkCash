import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    image_url: Mapped[str] = mapped_column(String(500))
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    receipt_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    merchant: Mapped[str] = mapped_column(String(255), default="")
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_verified: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    transaction = relationship("Transaction", back_populates="receipt", uselist=False)
