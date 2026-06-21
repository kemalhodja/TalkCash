"""Add micro_savings_prefs to users

Revision ID: 015
Revises: 014
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("micro_savings_prefs", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "micro_savings_prefs")
