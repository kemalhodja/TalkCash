"""Google Play purchase records

Revision ID: 008
Revises: 007
Create Date: 2026-06-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    plan_tier = postgresql.ENUM("free", "pro", "family", "business", name="plantier", create_type=False)

    op.create_table(
        "google_purchases",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.String(length=120), nullable=False),
        sa.Column("purchase_token", sa.String(length=512), nullable=False),
        sa.Column("order_id", sa.String(length=255), nullable=True),
        sa.Column("plan_tier", plan_tier, nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("purchase_token", name="uq_google_purchase_token"),
    )
    op.create_index("ix_google_purchases_user_id", "google_purchases", ["user_id"])
    op.create_index("ix_google_purchases_product_id", "google_purchases", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_google_purchases_product_id", table_name="google_purchases")
    op.drop_index("ix_google_purchases_user_id", table_name="google_purchases")
    op.drop_table("google_purchases")
