from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://mmms:mmms@localhost:5432/mmms"
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    access_token_expire_minutes: int = 60 * 12  # 12 hours
    algorithm: str = "HS256"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
