"""
Application configuration — all settings via environment variables.
Azure App Service / Container Apps use env vars natively.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "TB AI Intelligence Hub"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"  # development | staging | production
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"

    # Database — swap URL for Snowflake migration
    DATABASE_URL: str = "postgresql+asyncpg://tb_admin:tb_dev_password_2026@localhost:5432/tb_ai_hub"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_ECHO: bool = False

    # Auth
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — comma-separated origins
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100

    # Cache — future Redis URL
    CACHE_BACKEND: str = "memory"  # memory | redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_DEFAULT_TTL: int = 300

    # Storage — future Azure Blob
    STORAGE_BACKEND: str = "local"  # local | azure_blob
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AZURE_STORAGE_CONTAINER: str = "uploads"

    # Azure App Insights (future)
    APPLICATIONINSIGHTS_CONNECTION_STRING: str = ""

    # Initial admin account (created on first run)
    INITIAL_ADMIN_EMAIL: str = "admin@examplepe.com"
    INITIAL_ADMIN_PASSWORD: str = "TBAdmin2026!"
    INITIAL_ADMIN_FIRST_NAME: str = "TB"
    INITIAL_ADMIN_LAST_NAME: str = "Admin"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: str) -> str:
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "case_sensitive": True}


@lru_cache
def get_settings() -> Settings:
    return Settings()
