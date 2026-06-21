import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, pg_enum


class InsightType(str, enum.Enum):
    WEEKLY_SUMMARY = "weekly_summary"
    CASHFLOW = "cashflow"
    BUDGET_RISK = "budget_risk"
    ANOMALY = "anomaly"
    ACTION = "action"


class FinancialInsight(Base):
    __tablename__ = "financial_insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    insight_type: Mapped[InsightType] = mapped_column(pg_enum(InsightType), index=True)
    title: Mapped[str] = mapped_column(String(160))
    summary: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default="info")
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
