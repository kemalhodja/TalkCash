import base64

from openai import AsyncOpenAI

from app.config import settings
from app.utils.json_safe import safe_parse_json
PROMPT_TR = """Bu fotoğraf buzdolabı, mutfak rafı veya biten market ürünlerini gösteriyor olabilir.
Görünen tüketilebilir ürünleri Türkçe liste olarak çıkar.
Sadece JSON döndür: {"items": ["Süt", "Yumurta"]}
Boşsa {"items": []}. Tahmin etme; görünen veya bitmiş olabilecek ürünleri yaz."""

PROMPT_EN = """This photo may show a fridge, pantry shelf, or depleted groceries.
Extract visible consumable product names.
Return JSON only: {"items": ["Milk", "Eggs"]}
If none, {"items": []}. Do not invent items."""


class ShoppingVisionService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    async def extract_items(self, image_bytes: bytes, locale: str = "tr") -> list[str]:
        if not self.client:
            raise ValueError("OpenAI API key required for smart basket vision")
        b64 = base64.b64encode(image_bytes).decode("ascii")
        prompt = PROMPT_EN if locale == "en" else PROMPT_TR
        try:
            response = await self.client.chat.completions.create(
                model=settings.openai_model,
                response_format={"type": "json_object"},
                temperature=0.2,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                        ],
                    }
                ],
            )
            data = safe_parse_json(response.choices[0].message.content)
            items = data.get("items") or []
        except Exception:
            return []
        cleaned = []
        for item in items:
            if isinstance(item, str) and item.strip():
                cleaned.append(item.strip()[:255])
        return cleaned[:30]
