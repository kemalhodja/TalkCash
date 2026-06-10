"""Add user timezone

Revision ID: 002
Revises: 001
Create Date: 2025-06-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("timezone", sa.String(50), server_default="Europe/Istanbul"))


def downgrade() -> None:
    op.drop_column("users", "timezone")
