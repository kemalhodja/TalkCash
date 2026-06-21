import logging
from datetime import date, datetime, timedelta
from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.podcast import WeeklyPodcast
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.services.notifications.service import NotificationService
from app.services.storage.service import StorageService
from app.services.micro_savings.service import MICRO_SAVINGS_INPUT

logger = logging.getLogger(__name__)


class PodcastService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        self.storage = StorageService()
        self.notifications = NotificationService()

    def _week_start(self, when: datetime | None = None) -> date:
        now = when or datetime.utcnow()
        monday = now.date() - timedelta(days=now.weekday())
        return monday

    async def _weekly_stats(self, db: AsyncSession, user_id: UUID) -> dict:
        start = datetime.utcnow() - timedelta(days=7)
        result = await db.execute(
            select(Transaction.transaction_type, func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.user_id == user_id, Transaction.created_at >= start)
            .group_by(Transaction.transaction_type)
        )
        totals = {row[0].value: float(row[1]) for row in result.all()}
        income = totals.get(TransactionType.INCOME.value, 0)
        expense = totals.get(TransactionType.EXPENSE.value, 0)
        micro_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.transaction_type == TransactionType.TRANSFER,
                Transaction.input_method == MICRO_SAVINGS_INPUT,
                Transaction.created_at >= start,
            )
        )
        micro_saved = float(micro_result.scalar() or 0)
        return {
            "income": income,
            "expense": expense,
            "net": income - expense,
            "micro_saved": micro_saved,
        }

    async def _generate_script(self, stats: dict, locale: str) -> str:
        micro = stats.get("micro_saved", 0)
        if not self.client:
            if locale == "en":
                base = (
                    f"This week you earned {stats['income']:.0f} and spent {stats['expense']:.0f}. "
                    f"Net flow is {stats['net']:.0f}."
                )
                if micro > 0:
                    base += f" You moved {micro:.0f} into investment wallets — nice work!"
                else:
                    base += " Keep going!"
                return base
            base = (
                f"Bu hafta {stats['income']:.0f} TL gelir, {stats['expense']:.0f} TL gider yaptın. "
                f"Net akış {stats['net']:.0f} TL."
            )
            if micro > 0:
                base += f" Yatırım cüzdanlarına {micro:.0f} TL aktardın — harika!"
            else:
                base += " Harika gidiyorsun!"
            return base

        system = (
            "Write a friendly, constructive weekly finance summary in Turkish, max 120 words. "
            "Mention micro-savings moved to investment wallets when the amount is greater than zero. "
            "Do not give regulated investment advice."
            if locale == "tr"
            else "Write a friendly, constructive weekly finance summary in English, max 120 words. "
            "Mention micro-savings moved to investment wallets when the amount is greater than zero. "
            "Do not give regulated investment advice."
        )
        user_msg = (
            f"Income: {stats['income']:.2f}, Expense: {stats['expense']:.2f}, "
            f"Net: {stats['net']:.2f}, Micro savings to investments: {micro:.2f}"
        )
        response = await self.client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.7,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
        )
        return (response.choices[0].message.content or user_msg).strip()

    async def _synthesize_audio(self, script: str) -> bytes | None:
        if not self.client:
            return None
        response = await self.client.audio.speech.create(
            model="tts-1",
            voice="nova",
            input=script[:4096],
        )
        return response.content

    async def generate_for_user(self, db: AsyncSession, user: User, locale: str = "tr") -> WeeklyPodcast | None:
        week = self._week_start()
        existing = await db.execute(
            select(WeeklyPodcast).where(WeeklyPodcast.user_id == user.id, WeeklyPodcast.week_start == week)
        )
        if existing.scalar_one_or_none():
            return None

        stats = await self._weekly_stats(db, user.id)
        if stats["income"] == 0 and stats["expense"] == 0:
            return None

        script = await self._generate_script(stats, locale)
        audio_path = None
        audio_bytes = await self._synthesize_audio(script)
        if audio_bytes:
            audio_path = await self.storage.upload(str(user.id), audio_bytes, extension="mp3")

        podcast = WeeklyPodcast(
            user_id=user.id,
            week_start=week,
            script=script,
            audio_path=audio_path,
        )
        db.add(podcast)
        await db.commit()
        await db.refresh(podcast)

        await self.notifications.create_in_app(
            db,
            user.id,
            title="Haftalık sesli raporun hazır" if locale == "tr" else "Your weekly audio report is ready",
            body=script[:120],
            ntype="weekly_podcast",
            metadata={"route": "/", "podcast_id": str(podcast.id)},
        )
        if user.push_token:
            await self.notifications.send_push(
                user.push_token,
                "Haftalık sesli raporun hazır" if locale == "tr" else "Your weekly audio report is ready",
                script[:120],
                {"route": "/", "podcast_id": str(podcast.id), "type": "weekly_podcast"},
            )
        return podcast

    async def latest_for_user(self, db: AsyncSession, user_id: UUID) -> WeeklyPodcast | None:
        result = await db.execute(
            select(WeeklyPodcast)
            .where(WeeklyPodcast.user_id == user_id)
            .order_by(WeeklyPodcast.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def generate_all_users(self, db: AsyncSession) -> int:
        users = await db.execute(select(User))
        count = 0
        for user in users.scalars().all():
            locale = user.locale or "tr"
            try:
                created = await self.generate_for_user(db, user, locale=locale)
                if created:
                    count += 1
            except Exception:
                logger.exception("Weekly podcast failed for user %s", user.id)
        return count
