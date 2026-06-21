"""Add store_name to transactions and product_history table

Revision ID: 014
Revises: 013
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("store_name", sa.String(length=255), nullable=False, server_default=""),
    )
    op.execute(
        "UPDATE transactions SET store_name = COALESCE(NULLIF(place, ''), 'Genel') WHERE store_name = ''"
    )

    op.create_table(
        "product_history",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("product_name", sa.String(length=255), nullable=False),
        sa.Column("store_name", sa.String(length=255), nullable=False),
        sa.Column("price", sa.Numeric(15, 2), nullable=False),
        sa.Column("transaction_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_product_history_user_id", "product_history", ["user_id"])
    op.create_index("ix_product_history_product_name", "product_history", ["product_name"])
    op.create_index("ix_product_history_created_at", "product_history", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_product_history_created_at", table_name="product_history")
    op.drop_index("ix_product_history_product_name", table_name="product_history")
    op.drop_index("ix_product_history_user_id", table_name="product_history")
    op.drop_table("product_history")
    op.drop_column("transactions", "store_name")
