"""Roadmap features and user votes

Revision ID: 016
Revises: 015
"""
from typing import Sequence, Union
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

roadmap_status = postgresql.ENUM("active", "soon", "backlog", name="roadmapstatus", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    roadmap_status.create(bind, checkfirst=True)

    op.create_table(
        "roadmap_features",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title_tr", sa.String(length=255), nullable=False),
        sa.Column("title_en", sa.String(length=255), nullable=False),
        sa.Column("description_tr", sa.Text(), nullable=False),
        sa.Column("description_en", sa.Text(), nullable=False),
        sa.Column("status", roadmap_status, nullable=False),
        sa.Column("vote_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_roadmap_features_status", "roadmap_features", ["status"])

    op.create_table(
        "roadmap_votes",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("feature_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["feature_id"], ["roadmap_features.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "feature_id"),
        sa.UniqueConstraint("user_id", "feature_id", name="uq_roadmap_vote_user_feature"),
    )

    seed_rows = [
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Sesli harcama girişi",
                "title_en": "Voice expense entry",
                "description_tr": "Whisper ile konuşarak harcama kaydedin; Türkçe NLP anında işler.",
                "description_en": "Record expenses by voice with Whisper and Turkish NLP parsing.",
                "status": "active",
                "vote_count": 0,
                "sort_order": 10,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Fiyat casusluğu",
                "title_en": "Price watch",
                "description_tr": "Market ürün fiyatlarını takip edin, düşüşte anında bildirim alın.",
                "description_en": "Track grocery prices and get alerts when they drop.",
                "status": "active",
                "vote_count": 0,
                "sort_order": 20,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Akıllı tasarruf koçu",
                "title_en": "Smart savings coach",
                "description_tr": "Harcama sonrası alternatif öner; tasarrufu yatırım cüzdanına aktar.",
                "description_en": "Post-spend swap nudges and micro-savings transfers.",
                "status": "active",
                "vote_count": 0,
                "sort_order": 30,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Fiş OCR tarama",
                "title_en": "Receipt OCR scanning",
                "description_tr": "Fiş fotoğrafından otomatik harcama çıkarımı.",
                "description_en": "Extract expenses automatically from receipt photos.",
                "status": "active",
                "vote_count": 0,
                "sort_order": 40,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Otomatik yuvarlama tasarrufu",
                "title_en": "Automatic round-up savings",
                "description_tr": "Harcamaları yuvarlayıp küsuratı yatırım cüzdanına otomatik taşı.",
                "description_en": "Round up purchases and move spare change to investment wallets.",
                "status": "soon",
                "vote_count": 0,
                "sort_order": 50,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Haftalık finans podcast",
                "title_en": "Weekly finance podcast",
                "description_tr": "AI koçunuzun haftalık sesli finans özetiniz.",
                "description_en": "Your AI coach's weekly audio finance summary.",
                "status": "soon",
                "vote_count": 0,
                "sort_order": 60,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Gelişmiş Insights dashboard",
                "title_en": "Advanced Insights dashboard",
                "description_tr": "Nakit akışı, bütçe sağlığı ve AI içgörüleri tek ekranda.",
                "description_en": "Cashflow, budget health, and AI insights in one screen.",
                "status": "soon",
                "vote_count": 0,
                "sort_order": 70,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Otomatik banka entegrasyonu",
                "title_en": "Automatic bank integration",
                "description_tr": "Banka hesaplarınızı bağlayın; harcamalar anında düşsün.",
                "description_en": "Connect bank accounts and sync transactions automatically.",
                "status": "backlog",
                "vote_count": 0,
                "sort_order": 100,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Gelişmiş ortak cüzdan",
                "title_en": "Enhanced shared wallets",
                "description_tr": "Arkadaşlarla ortak kasa, borç defteri ve hesap bölme 2.0.",
                "description_en": "Shared wallets, debt book, and bill splitting v2.",
                "status": "backlog",
                "vote_count": 0,
                "sort_order": 110,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "iOS uygulaması",
                "title_en": "iOS app",
                "description_tr": "TalkCash'i iPhone ve iPad'de native deneyimle kullanın.",
                "description_en": "Native TalkCash experience on iPhone and iPad.",
                "status": "backlog",
                "vote_count": 0,
                "sort_order": 120,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Kripto portföy takibi",
                "title_en": "Crypto portfolio tracking",
                "description_tr": "BTC, ETH ve altcoin varlıklarını net varlığa ekleyin.",
                "description_en": "Track BTC, ETH, and altcoins in your net worth.",
                "status": "backlog",
                "vote_count": 0,
                "sort_order": 130,
            },
            {
                "id": str(uuid.uuid4()),
                "title_tr": "Aile bütçe dashboard",
                "title_en": "Family budget dashboard",
                "description_tr": "Çalışma alanı üyeleri için ortak harcama ve hedef paneli.",
                "description_en": "Shared spending and goals panel for workspace members.",
                "status": "backlog",
                "vote_count": 0,
                "sort_order": 140,
            },
    ]
    insert_sql = sa.text(
        """
        INSERT INTO roadmap_features
            (id, title_tr, title_en, description_tr, description_en, status, vote_count, sort_order)
        VALUES
            (:id, :title_tr, :title_en, :description_tr, :description_en,
             CAST(:status AS roadmapstatus), :vote_count, :sort_order)
        """
    )
    bind = op.get_bind()
    for row in seed_rows:
        bind.execute(insert_sql, row)


def downgrade() -> None:
    op.drop_table("roadmap_votes")
    op.drop_index("ix_roadmap_features_status", table_name="roadmap_features")
    op.drop_table("roadmap_features")
    roadmap_status.drop(op.get_bind(), checkfirst=True)
