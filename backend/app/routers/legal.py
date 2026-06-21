from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["Legal"])

DOCS_DIR = Path(__file__).resolve().parents[2] / "docs"


def _markdown_page(title: str, filename: str) -> HTMLResponse:
    path = DOCS_DIR / filename
    body = path.read_text(encoding="utf-8") if path.exists() else f"# {title}\n\nContent unavailable."
    escaped = (
        body.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    html = f"""<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{title} — TalkCash</title>
<style>body{{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#111}}
pre{{white-space:pre-wrap;word-wrap:break-word}}</style></head>
<body><h1>{title}</h1><pre>{escaped}</pre></body></html>"""
    return HTMLResponse(html)


@router.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    return _markdown_page("Privacy Policy", "PRIVACY.md")


@router.get("/terms", response_class=HTMLResponse)
async def terms_of_service():
    return _markdown_page("Terms of Service", "TERMS.md")
