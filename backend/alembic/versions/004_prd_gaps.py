"""PRD gaps: agenda paid_at, price watchlist, shared wallet ledger

Revision ID: 004
Revises: 003
Create Date: 2026-06-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agenda_items", sa.Column("paid_at", sa.DateTime(), nullable=True))

    op.create_table(
        "price_watch_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("product_name", sa.String(100), nullable=False),
        sa.Column("threshold_percent", sa.Numeric(5, 2), server_default="5"),
        sa.Column("last_avg_price", sa.Numeric(15, 2), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "product_name", name="uq_price_watch_user_product"),
    )

    op.create_table(
        "shared_wallet_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shared_wallets.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("entry_type", sa.String(20), nullable=False),
        sa.Column("description", sa.String(255), server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_shared_wallet_entries_wallet_id", "shared_wallet_entries", ["wallet_id"])


def downgrade() -> None:
    op.drop_index("ix_shared_wallet_entries_wallet_id", table_name="shared_wallet_entries")
    op.drop_table("shared_wallet_entries")
    op.drop_table("price_watch_items")
    op.drop_column("agenda_items", "paid_at")
