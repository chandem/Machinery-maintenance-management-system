from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://mmms:mmms@localhost:5432/mmms"
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    access_token_expire_minutes: int = 60 * 12  # 12 hours
    algorithm: str = "HS256"
    # When true, POST/PATCH/DELETE require a valid JWT (GET stays open for dashboards)
    require_auth_writes: bool = True
    public_app_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
