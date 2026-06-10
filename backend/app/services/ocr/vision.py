import base64
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def google_vision_text(image_bytes: bytes) -> str:
    """Extract text via Google Cloud Vision REST API (optional)."""
    if not settings.google_vision_api_key:
        return ""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://vision.googleapis.com/v1/images:annotate?key={settings.google_vision_api_key}",
                json={
                    "requests": [{
                        "image": {"content": base64.b64encode(image_bytes).decode()},
                        "features": [{"type": "TEXT_DETECTION"}],
                    }],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            annotations = data.get("responses", [{}])[0].get("textAnnotations", [])
            if annotations:
                return annotations[0].get("description", "")
    except Exception as exc:
        logger.warning("Google Vision OCR failed: %s", exc)
    return ""
