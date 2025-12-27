from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://app:app@localhost:5432/app"

    # Environment
    environment: str = "development"

    # Logging
    log_level: str = "INFO"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


settings = Settings()
