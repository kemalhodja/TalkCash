from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "TalkCash API"
    debug: bool = True

    database_url: str = "postgresql+asyncpg://talkcash:talkcash@localhost:5432/talkcash"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    whisper_model: str = "whisper-1"

    exchange_rate_api: str = "https://api.exchangerate-api.com/v4/latest/TRY"

    class Config:
        env_file = ".env"


settings = Settings()
