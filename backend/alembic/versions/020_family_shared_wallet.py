"""Family workspace shared wallet links

Revision ID: 020
Revises: 019
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("shared_wallet_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_org_shared_wallet",
        "organizations",
        "shared_wallets",
        ["shared_wallet_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("shared_wallets", sa.Column("organization_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_shared_wallet_org",
        "shared_wallets",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_shared_wallet_org", "shared_wallets", type_="foreignkey")
    op.drop_column("shared_wallets", "organization_id")
    op.drop_constraint("fk_org_shared_wallet", "organizations", type_="foreignkey")
    op.drop_column("organizations", "shared_wallet_id")
