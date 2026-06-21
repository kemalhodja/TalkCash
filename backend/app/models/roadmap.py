import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, pg_enum


class RoadmapStatus(str, enum.Enum):
    ACTIVE = "active"
    SOON = "soon"
    BACKLOG = "backlog"


class RoadmapFeature(Base):
    __tablename__ = "roadmap_features"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title_tr: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    description_tr: Mapped[str] = mapped_column(Text, nullable=False)
    description_en: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[RoadmapStatus] = mapped_column(pg_enum(RoadmapStatus), nullable=False, index=True)
    vote_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    votes = relationship("RoadmapVote", back_populates="feature", cascade="all, delete-orphan")


class RoadmapVote(Base):
    __tablename__ = "roadmap_votes"
    __table_args__ = (UniqueConstraint("user_id", "feature_id", name="uq_roadmap_vote_user_feature"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    feature_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roadmap_features.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    feature = relationship("RoadmapFeature", back_populates="votes")
