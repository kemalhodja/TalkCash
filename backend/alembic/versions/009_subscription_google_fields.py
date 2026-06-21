"""Align subscriptions table with Google Play subscription fields

Revision ID: 009
Revises: 008
Create Date: 2026-06-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE subscriptionstatus ADD VALUE IF NOT EXISTS 'inactive'")
    op.execute("ALTER TYPE subscriptionstatus ADD VALUE IF NOT EXISTS 'grace_period'")
    op.execute("ALTER TYPE subscriptionstatus ADD VALUE IF NOT EXISTS 'expired'")

    op.alter_column("subscriptions", "created_at", new_column_name="start_date")
    op.alter_column("subscriptions", "current_period_end", new_column_name="expire_date")

    op.add_column("subscriptions", sa.Column("google_product_id", sa.String(length=120), nullable=True))
    op.add_column("subscriptions", sa.Column("purchase_token", sa.String(length=512), nullable=True))

    op.execute(
        """
        UPDATE subscriptions
        SET purchase_token = provider_subscription_id
        WHERE provider_subscription_id IS NOT NULL
        """
    )

    op.create_index("ix_subscriptions_google_product_id", "subscriptions", ["google_product_id"])
    op.create_unique_constraint("uq_subscription_purchase_token", "subscriptions", ["purchase_token"])
    op.drop_column("subscriptions", "provider_subscription_id")


def downgrade() -> None:
    op.add_column("subscriptions", sa.Column("provider_subscription_id", sa.String(length=255), nullable=True))
    op.execute(
        "UPDATE subscriptions SET provider_subscription_id = purchase_token WHERE purchase_token IS NOT NULL"
    )
    op.drop_constraint("uq_subscription_purchase_token", "subscriptions", type_="unique")
    op.drop_index("ix_subscriptions_google_product_id", table_name="subscriptions")
    op.drop_column("subscriptions", "purchase_token")
    op.drop_column("subscriptions", "google_product_id")
    op.alter_column("subscriptions", "expire_date", new_column_name="current_period_end")
    op.alter_column("subscriptions", "start_date", new_column_name="created_at")
