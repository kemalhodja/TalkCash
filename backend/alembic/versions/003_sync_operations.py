"""Sync operation idempotency table

Revision ID: 003
Revises: 002
Create Date: 2026-06-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sync_operations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "operation_id", name="uq_sync_user_operation"),
    )
    op.create_index("ix_sync_operations_user_id", "sync_operations", ["user_id"])
    op.create_index("ix_sync_operations_operation_id", "sync_operations", ["operation_id"])


def downgrade() -> None:
    op.drop_index("ix_sync_operations_operation_id", table_name="sync_operations")
    op.drop_index("ix_sync_operations_user_id", table_name="sync_operations")
    op.drop_table("sync_operations")
