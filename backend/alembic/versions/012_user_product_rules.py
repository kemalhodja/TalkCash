"""Add user_product_rules and shopping_suggestion_logs tables

Revision ID: 012
Revises: 011
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_product_rules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.String(length=255), nullable=False),
        sa.Column("suggested_product_id", sa.String(length=255), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "product_id", "suggested_product_id", name="uq_user_product_rule"),
    )
    op.create_index("ix_user_product_rules_user_id", "user_product_rules", ["user_id"])
    op.create_index("ix_user_product_rules_product_id", "user_product_rules", ["product_id"])

    op.create_table(
        "shopping_suggestion_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("suggested_item", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shopping_suggestion_logs_user_id", "shopping_suggestion_logs", ["user_id"])
    op.create_index("ix_shopping_suggestion_logs_created_at", "shopping_suggestion_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_shopping_suggestion_logs_created_at", table_name="shopping_suggestion_logs")
    op.drop_index("ix_shopping_suggestion_logs_user_id", table_name="shopping_suggestion_logs")
    op.drop_table("shopping_suggestion_logs")
    op.drop_index("ix_user_product_rules_product_id", table_name="user_product_rules")
    op.drop_index("ix_user_product_rules_user_id", table_name="user_product_rules")
    op.drop_table("user_product_rules")
