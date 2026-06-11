from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    app_name: str = "TalkCash API"
    debug: bool = True

    database_url: str = "postgresql+asyncpg://talkcash:talkcash@localhost:5432/talkcash"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    allowed_origins: str = "*"
    rate_limit_enabled: bool = True
    auth_rate_limit: int = 30
    input_rate_limit: int = 60
    voice_rate_limit: int = 20
    ocr_rate_limit: int = 15
    ocr_max_upload_bytes: int = 10 * 1024 * 1024

    sync_rate_limit: int = 30

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    whisper_model: str = "whisper-1"

    exchange_rate_api: str = "https://api.exchangerate-api.com/v4/latest/TRY"

    # S3 / MinIO
    s3_enabled: bool = False
    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "talkcash"
    s3_region: str = "us-east-1"
    s3_public_url: str = ""

    scheduler_enabled: bool = True

    overpass_enabled: bool = True
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    geofence_cache_ttl: int = 3600

    app_timezone: str = "Europe/Istanbul"

    # OCR: tesseract | google | auto (tesseract first, Vision fallback)
    ocr_provider: str = "auto"
    google_vision_api_key: str = ""


settings = Settings()
