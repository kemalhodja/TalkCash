"""v1.2: assistant persona + recurring transaction fields

Revision ID: 017
Revises: 016
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("assistant_persona", sa.String(length=32), nullable=False, server_default="default"),
    )
    op.add_column(
        "transactions",
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "transactions",
        sa.Column("next_billing_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("subscription_name", sa.String(length=255), nullable=True),
    )
    op.create_index("ix_transactions_subscription", "transactions", ["user_id", "is_recurring"])


def downgrade() -> None:
    op.drop_index("ix_transactions_subscription", table_name="transactions")
    op.drop_column("transactions", "subscription_name")
    op.drop_column("transactions", "next_billing_date")
    op.drop_column("transactions", "is_recurring")
    op.drop_column("users", "assistant_persona")
