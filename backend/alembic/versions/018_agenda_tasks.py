"""Agenda todo tasks — item_type, optional amount, notes

Revision ID: 018
Revises: 017
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agenda_items",
        sa.Column("item_type", sa.String(length=16), nullable=False, server_default="bill"),
    )
    op.add_column("agenda_items", sa.Column("notes", sa.Text(), nullable=True))
    op.alter_column("agenda_items", "amount", existing_type=sa.Numeric(15, 2), nullable=True)


def downgrade() -> None:
    op.alter_column("agenda_items", "amount", existing_type=sa.Numeric(15, 2), nullable=False)
    op.drop_column("agenda_items", "notes")
    op.drop_column("agenda_items", "item_type")
