"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-06-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), default=""),
        sa.Column("pin_code", sa.String(255), nullable=True),
        sa.Column("biometric_enabled", sa.Boolean(), default=False),
        sa.Column("push_token", sa.String(500), nullable=True),
        sa.Column("locale", sa.String(5), server_default="tr"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "exchange_rates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("currency", sa.String(10), unique=True, index=True),
        sa.Column("rate_to_try", sa.Numeric(15, 6)),
        sa.Column("updated_at", sa.DateTime()),
    )
    op.create_table(
        "wallets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(100)),
        sa.Column("wallet_type", sa.Enum("cash", "bank", "credit_card", "investment_gold", "investment_forex", "custom", name="wallettype")),
        sa.Column("balance", sa.Numeric(15, 2), server_default="0"),
        sa.Column("currency", sa.String(10), server_default="TRY"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("image_url", sa.String(500)),
        sa.Column("total_amount", sa.Numeric(15, 2), nullable=True),
        sa.Column("receipt_date", sa.DateTime(), nullable=True),
        sa.Column("merchant", sa.String(255)),
        sa.Column("ocr_raw_text", sa.Text(), nullable=True),
        sa.Column("is_verified", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("wallets.id")),
        sa.Column("target_wallet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("wallets.id"), nullable=True),
        sa.Column("transaction_type", sa.Enum("expense", "income", "transfer", name="transactiontype")),
        sa.Column("amount", sa.Numeric(15, 2)),
        sa.Column("currency", sa.String(10), server_default="TRY"),
        sa.Column("category", sa.String(100)),
        sa.Column("description", sa.String(255)),
        sa.Column("place", sa.String(255)),
        sa.Column("input_method", sa.String(50)),
        sa.Column("receipt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("receipts.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "agenda_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("title", sa.String(255)),
        sa.Column("amount", sa.Numeric(15, 2)),
        sa.Column("currency", sa.String(10)),
        sa.Column("due_date", sa.DateTime()),
        sa.Column("status", sa.Enum("pending", "paid", "overdue", name="agendastatus")),
        sa.Column("is_recurring", sa.Boolean()),
        sa.Column("recurrence_months", sa.Integer()),
        sa.Column("installment_total", sa.Integer(), nullable=True),
        sa.Column("installment_current", sa.Integer(), nullable=True),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agenda_items.id"), nullable=True),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("wallets.id"), nullable=True),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "shopping_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("name", sa.String(255)),
        sa.Column("category", sa.Enum("sarkuteri", "manav", "sut_urunleri", "temizlik", "firin", "icecek", "diger", name="shoppingcategory")),
        sa.Column("is_completed", sa.Boolean(), default=False),
        sa.Column("is_routine", sa.Boolean(), default=False),
        sa.Column("routine_type", sa.String(20), nullable=True),
        sa.Column("price", sa.Numeric(15, 2), nullable=True),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "budget_limits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("category", sa.String(100)),
        sa.Column("monthly_limit", sa.Numeric(15, 2)),
        sa.Column("currency", sa.String(10)),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("title", sa.String(255)),
        sa.Column("body", sa.Text()),
        sa.Column("notification_type", sa.String(50)),
        sa.Column("is_read", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "shared_wallets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100)),
        sa.Column("balance", sa.Numeric(15, 2)),
        sa.Column("currency", sa.String(10)),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("member_ids", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "debt_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("person_name", sa.String(255)),
        sa.Column("amount", sa.Numeric(15, 2)),
        sa.Column("currency", sa.String(10)),
        sa.Column("is_lent", sa.Boolean()),
        sa.Column("is_settled", sa.Boolean()),
        sa.Column("due_date", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "split_bills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("total_amount", sa.Numeric(15, 2)),
        sa.Column("person_count", sa.Integer()),
        sa.Column("per_person", sa.Numeric(15, 2)),
        sa.Column("share_message", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
    )


def downgrade() -> None:
    for table in [
        "split_bills", "debt_records", "shared_wallets", "notifications",
        "budget_limits", "shopping_items", "agenda_items", "transactions",
        "receipts", "wallets", "exchange_rates", "users",
    ]:
        op.drop_table(table)
    for enum in ["wallettype", "transactiontype", "agendastatus", "shoppingcategory"]:
        sa.Enum(name=enum).drop(op.get_bind(), checkfirst=True)
