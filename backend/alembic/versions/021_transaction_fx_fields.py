"""Transaction FX metadata columns

Revision ID: 021_transaction_fx
Revises: 020_family_shared_wallet
Create Date: 2026-06-27
"""

from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("original_amount", sa.Numeric(15, 2), nullable=True))
    op.add_column("transactions", sa.Column("original_currency", sa.String(10), nullable=True))
    op.add_column("transactions", sa.Column("fx_rate", sa.Numeric(15, 6), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "fx_rate")
    op.drop_column("transactions", "original_currency")
    op.drop_column("transactions", "original_amount")
