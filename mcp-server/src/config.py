from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql://app:app@localhost:5432/app"

    # FastAPI Backend
    fastapi_url: str = "http://localhost:8000"

    # Frontend
    frontend_url: str = "http://localhost:5173"

    # MCP Server
    mcp_port: int = 8080

    # Logging
    log_level: str = "INFO"


settings = Settings()
