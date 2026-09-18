from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://mmms:mmms@localhost:5432/mmms"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
