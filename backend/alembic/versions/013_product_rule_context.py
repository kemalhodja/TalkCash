"""Add contextual filters to user_product_rules

Revision ID: 013
Revises: 012
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_product_rules", sa.Column("context_time_bucket", sa.String(length=20), nullable=True))
    op.add_column("user_product_rules", sa.Column("context_day_type", sa.String(length=20), nullable=True))
    op.add_column("user_product_rules", sa.Column("trigger_category", sa.String(length=32), nullable=True))
    op.add_column("user_product_rules", sa.Column("suggested_category", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("user_product_rules", "suggested_category")
    op.drop_column("user_product_rules", "trigger_category")
    op.drop_column("user_product_rules", "context_day_type")
    op.drop_column("user_product_rules", "context_time_bucket")
