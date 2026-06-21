from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.i18n import I18nError
from app.models.roadmap import RoadmapFeature, RoadmapStatus, RoadmapVote

DEFAULT_FEATURES: list[dict] = [
    {
        "title_tr": "Sesli harcama girişi",
        "title_en": "Voice expense entry",
        "description_tr": "Whisper ile konuşarak harcama kaydedin; Türkçe NLP anında işler.",
        "description_en": "Record expenses by voice with Whisper and Turkish NLP parsing.",
        "status": RoadmapStatus.ACTIVE,
        "sort_order": 10,
    },
    {
        "title_tr": "Fiyat casusluğu",
        "title_en": "Price watch",
        "description_tr": "Market ürün fiyatlarını takip edin, düşüşte anında bildirim alın.",
        "description_en": "Track grocery prices and get alerts when they drop.",
        "status": RoadmapStatus.ACTIVE,
        "sort_order": 20,
    },
    {
        "title_tr": "Akıllı tasarruf koçu",
        "title_en": "Smart savings coach",
        "description_tr": "Harcama sonrası alternatif öner; tasarrufu yatırım cüzdanına aktar.",
        "description_en": "Post-spend swap nudges and micro-savings transfers.",
        "status": RoadmapStatus.ACTIVE,
        "sort_order": 30,
    },
    {
        "title_tr": "Fiş OCR tarama",
        "title_en": "Receipt OCR scanning",
        "description_tr": "Fiş fotoğrafından otomatik harcama çıkarımı.",
        "description_en": "Extract expenses automatically from receipt photos.",
        "status": RoadmapStatus.ACTIVE,
        "sort_order": 40,
    },
    {
        "title_tr": "Otomatik yuvarlama tasarrufu",
        "title_en": "Automatic round-up savings",
        "description_tr": "Harcamaları yuvarlayıp küsuratı yatırım cüzdanına otomatik taşı.",
        "description_en": "Round up purchases and move spare change to investment wallets.",
        "status": RoadmapStatus.SOON,
        "sort_order": 50,
    },
    {
        "title_tr": "Haftalık finans podcast",
        "title_en": "Weekly finance podcast",
        "description_tr": "AI koçunuzun haftalık sesli finans özetiniz.",
        "description_en": "Your AI coach's weekly audio finance summary.",
        "status": RoadmapStatus.SOON,
        "sort_order": 60,
    },
    {
        "title_tr": "Gelişmiş Insights dashboard",
        "title_en": "Advanced Insights dashboard",
        "description_tr": "Nakit akışı, bütçe sağlığı ve AI içgörüleri tek ekranda.",
        "description_en": "Cashflow, budget health, and AI insights in one screen.",
        "status": RoadmapStatus.SOON,
        "sort_order": 70,
    },
    {
        "title_tr": "Otomatik banka entegrasyonu",
        "title_en": "Automatic bank integration",
        "description_tr": "Banka hesaplarınızı bağlayın; harcamalar anında düşsün.",
        "description_en": "Connect bank accounts and sync transactions automatically.",
        "status": RoadmapStatus.BACKLOG,
        "sort_order": 100,
    },
    {
        "title_tr": "Gelişmiş ortak cüzdan",
        "title_en": "Enhanced shared wallets",
        "description_tr": "Arkadaşlarla ortak kasa, borç defteri ve hesap bölme 2.0.",
        "description_en": "Shared wallets, debt book, and bill splitting v2.",
        "status": RoadmapStatus.BACKLOG,
        "sort_order": 110,
    },
    {
        "title_tr": "iOS uygulaması",
        "title_en": "iOS app",
        "description_tr": "TalkCash'i iPhone ve iPad'de native deneyimle kullanın.",
        "description_en": "Native TalkCash experience on iPhone and iPad.",
        "status": RoadmapStatus.BACKLOG,
        "sort_order": 120,
    },
    {
        "title_tr": "Kripto portföy takibi",
        "title_en": "Crypto portfolio tracking",
        "description_tr": "BTC, ETH ve altcoin varlıklarını net varlığa ekleyin.",
        "description_en": "Track BTC, ETH, and altcoins in your net worth.",
        "status": RoadmapStatus.BACKLOG,
        "sort_order": 130,
    },
    {
        "title_tr": "Aile bütçe dashboard",
        "title_en": "Family budget dashboard",
        "description_tr": "Çalışma alanı üyeleri için ortak harcama ve hedef paneli.",
        "description_en": "Shared spending and goals panel for workspace members.",
        "status": RoadmapStatus.BACKLOG,
        "sort_order": 140,
    },
]


class RoadmapService:
    async def ensure_seed_features(self, db: AsyncSession) -> None:
        count = await db.scalar(select(func.count()).select_from(RoadmapFeature))
        if count and count > 0:
            return
        for row in DEFAULT_FEATURES:
            db.add(RoadmapFeature(**row))
        await db.commit()

    async def list_grouped(self, db: AsyncSession, user_id: UUID, locale: str) -> dict:
        await self.ensure_seed_features(db)
        result = await db.execute(select(RoadmapFeature).order_by(RoadmapFeature.sort_order, RoadmapFeature.created_at))
        features = result.scalars().all()

        voted_ids: set[UUID] = set()
        if user_id:
            votes = await db.execute(select(RoadmapVote.feature_id).where(RoadmapVote.user_id == user_id))
            voted_ids = set(votes.scalars().all())

        grouped = {"active": [], "soon": [], "backlog": []}
        use_en = locale.startswith("en")
        for feature in features:
            item = {
                "id": feature.id,
                "title": feature.title_en if use_en else feature.title_tr,
                "description": feature.description_en if use_en else feature.description_tr,
                "status": feature.status.value,
                "vote_count": feature.vote_count,
                "is_voted": feature.id in voted_ids,
                "sort_order": feature.sort_order,
            }
            grouped[feature.status.value].append(item)
        return grouped

    async def vote(self, db: AsyncSession, user_id: UUID, feature_id: UUID) -> RoadmapFeature:
        feature = await db.get(RoadmapFeature, feature_id)
        if not feature:
            raise I18nError("roadmap.feature_not_found")
        if feature.status != RoadmapStatus.BACKLOG:
            raise I18nError("roadmap.voting_not_allowed")

        existing = await db.scalar(
            select(RoadmapVote).where(
                RoadmapVote.user_id == user_id,
                RoadmapVote.feature_id == feature_id,
            )
        )
        if existing:
            raise I18nError("roadmap.already_voted")

        db.add(RoadmapVote(user_id=user_id, feature_id=feature_id))
        feature.vote_count += 1
        await db.commit()
        await db.refresh(feature)
        return feature
