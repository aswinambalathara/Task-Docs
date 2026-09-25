import json

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Tethr API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # MongoDB Atlas Settings
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "tethr_dev"

    # Clerk Authentication
    CLERK_ISSUER: str = ""
    CLERK_JWKS_URL: str = ""
    DEV_MOCK_AUTH: bool = True  # Allows offline/dev mode without requiring live Clerk network calls

    # AES-256 Encryption key for tokens (32 bytes Base64 from environment)
    TOKEN_ENCRYPTION_KEY: str = ""

    # Google OAuth 2.0 & Docs Integration
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/settings"
    GOOGLE_SCOPES: list[str] = [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive.file",
    ]

    # Google Gemini AI Summarization (Gemini 2.0 Flash)
    GEMINI_API_KEY: str = ""

    # Logging Configuration
    LOG_DIR: str = "logs"
    LOG_LEVEL: str = "INFO"
    LOG_RETENTION_DAYS: int = 7
    LOG_ROTATION: str = "20 MB"

    # CORS configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )


settings = Settings()
