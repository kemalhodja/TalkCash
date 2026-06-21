"""Add notification_prefs JSON column to users

Revision ID: 010
Revises: 009
Create Date: 2026-06-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("notification_prefs", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "notification_prefs")
