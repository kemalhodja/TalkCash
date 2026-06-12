"""Shared validation helpers for uploads and monetary values."""

from decimal import Decimal, InvalidOperation

MAX_MONEY = Decimal("999999999.99")
MAX_TEXT_LEN = 500
MAX_SYNC_BATCH = 50
MAX_EXPORT_ROWS = 2000

_IMAGE_SIGNATURES = (
    b"\xff\xd8\xff",  # JPEG
    b"\x89PNG\r\n\x1a\n",  # PNG
    b"GIF87a",
    b"GIF89a",
    b"RIFF",  # WebP container (RIFF....WEBP)
)

_AUDIO_SIGNATURES = (
    b"RIFF",  # WAV
    b"OggS",
    b"\x1aE\xdf\xa3",  # WebM
    b"ID3",
    b"\xff\xfb",
    b"\xff\xf3",
    b"\xff\xf2",
    b"fLaC",
)


def parse_positive_amount(value: object, *, field: str = "amount") -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError) as exc:
        raise ValueError(f"invalid {field}") from exc
    if amount <= 0 or amount > MAX_MONEY:
        raise ValueError(f"invalid {field}")
    return amount


def clamp_text(value: str | None, max_len: int = MAX_TEXT_LEN) -> str:
    return (value or "")[:max_len]


def validate_image_bytes(data: bytes, max_bytes: int) -> None:
    if len(data) == 0:
        raise ValueError("empty file")
    if len(data) > max_bytes:
        raise ValueError("file too large")
    if not any(data.startswith(sig) for sig in _IMAGE_SIGNATURES):
        raise ValueError("unsupported image type")
    try:
        from PIL import Image

        image = Image.open(__import__("io").BytesIO(data))
        width, height = image.size
        if width * height > 25_000_000:
            raise ValueError("image too large")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("invalid image") from exc


def validate_audio_bytes(data: bytes, max_bytes: int) -> None:
    if len(data) == 0:
        raise ValueError("empty file")
    if len(data) > max_bytes:
        raise ValueError("file too large")
    head = data[:12]
    if any(head.startswith(sig) for sig in _AUDIO_SIGNATURES):
        return
    if len(data) > 8 and data[4:8] == b"ftyp":
        return
    raise ValueError("unsupported audio type")
