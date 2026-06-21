"""Add weekly_podcasts table

Revision ID: 011
Revises: 010
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weekly_podcasts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("script", sa.Text(), nullable=False),
        sa.Column("audio_path", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_podcast_user_week"),
    )
    op.create_index("ix_weekly_podcasts_user_id", "weekly_podcasts", ["user_id"])
    op.create_index("ix_weekly_podcasts_week_start", "weekly_podcasts", ["week_start"])
    op.create_index("ix_weekly_podcasts_created_at", "weekly_podcasts", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_weekly_podcasts_created_at", table_name="weekly_podcasts")
    op.drop_index("ix_weekly_podcasts_week_start", table_name="weekly_podcasts")
    op.drop_index("ix_weekly_podcasts_user_id", table_name="weekly_podcasts")
    op.drop_table("weekly_podcasts")
