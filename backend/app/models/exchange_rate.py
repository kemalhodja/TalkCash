import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    currency: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    rate_to_try: Mapped[Decimal] = mapped_column(Numeric(15, 6))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
