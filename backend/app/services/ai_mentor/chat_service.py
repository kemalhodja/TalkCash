import json
from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.i18n import t
from app.models.chat_message import ChatMessage
from app.services.ai_mentor.service import AIMentorService
from app.services.wallet.service import WalletService

mentor_service = AIMentorService()
wallet_service = WalletService()

CHAT_SYSTEM_TR = """Sen TalkCash kişisel finans asistanısın. Kullanıcının bütçe, harcama ve tasarruf sorularına
kısa, net, Türkçe yanıt ver. Yatırım tavsiyesi verme; genel finansal alışkanlık öner.
Kullanıcı bağlamı JSON olarak verilir — buna dayanarak kişiselleştir."""

CHAT_SYSTEM_EN = """You are TalkCash personal finance assistant. Answer budget, spending, and savings questions
briefly in English. Do not give investment advice; suggest general money habits.
User context is provided as JSON — personalize your reply."""


class ChatMentorService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    async def _build_context(self, db: AsyncSession, user_id: UUID, locale: str) -> dict:
        nw = await wallet_service.get_net_worth(db, user_id)
        alerts = await mentor_service.check_budget_alerts(db, user_id, locale)
        forecast = await mentor_service.predict_month_end(db, user_id, nw.total_try, locale)
        return {
            "net_worth_try": float(nw.total_try),
            "wallets": [{"name": w.name, "balance_try": float(w.balance_try)} for w in nw.wallets[:5]],
            "budget_alerts": alerts[:3],
            "burn_rate_daily": float(forecast.get("burn_rate_daily", 0)),
            "projected_balance": float(forecast.get("projected_balance", 0)),
        }

    async def list_history(self, db: AsyncSession, user_id: UUID, limit: int = 30) -> list[ChatMessage]:
        result = await db.execute(
            select(ChatMessage).where(ChatMessage.user_id == user_id)
            .order_by(ChatMessage.created_at.desc()).limit(limit)
        )
        return list(reversed(result.scalars().all()))

    async def chat(self, db: AsyncSession, user_id: UUID, message: str, locale: str = "tr") -> ChatMessage:
        text = message.strip()
        if not text:
            raise ValueError(t("ai.chat_empty", locale))

        user_msg = ChatMessage(user_id=user_id, role="user", content=text)
        db.add(user_msg)
        await db.flush()

        context = await self._build_context(db, user_id, locale)
        history = await self.list_history(db, user_id, limit=10)
        # Exclude the message we just added from LLM history (already in `message`)
        history = [m for m in history if m.id != user_msg.id]
        reply = await self._generate_reply(text, context, history, locale)

        assistant_msg = ChatMessage(user_id=user_id, role="assistant", content=reply)
        db.add(assistant_msg)
        await db.commit()
        await db.refresh(assistant_msg)
        return assistant_msg

    async def _generate_reply(
        self, message: str, context: dict, history: list[ChatMessage], locale: str,
    ) -> str:
        if not self.client:
            return t("ai.chat_offline", locale)

        system = CHAT_SYSTEM_EN if locale == "en" else CHAT_SYSTEM_TR
        messages = [
            {"role": "system", "content": system},
            {"role": "system", "content": f"Context: {json.dumps(context, ensure_ascii=False)}"},
        ]
        for msg in history[-8:]:
            if msg.role in ("user", "assistant"):
                messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": message})

        response = await self.client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.6,
            max_tokens=500,
            messages=messages,
        )
        return response.choices[0].message.content.strip()
