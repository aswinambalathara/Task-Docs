import json
from typing import NamedTuple

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

    # Model Context Protocol (MCP) Configuration
    MCP_SSE_URL: str = "http://localhost:8000/sse"
    MCP_JWT_SECRET: str = ""
    MCP_AUTH_CODE_TTL_SECONDS: int = 600  # 10 minutes
    MCP_TOKEN_EXPIRATION_SECONDS: int = 2592000  # 30 days

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


class EnvCheckItem(NamedTuple):
    name: str
    description: str
    is_present: bool
    is_critical: bool = True


def audit_environment(cfg: Settings) -> None:
    """
    Audits application configuration on startup and emits structured logs
    highlighting missing essential and optional environment variables.
    """
    from loguru import logger

    logger.info("Auditing environment configuration on startup...")

    if cfg.DEV_MOCK_AUTH:
        logger.info("[CONFIG] DEV_MOCK_AUTH=True: Local development mock authentication is active.")

    checks: list[EnvCheckItem] = [
        # Essential Infrastructure & Security
        EnvCheckItem(
            "MONGODB_URL", "MongoDB connection URI", bool(cfg.MONGODB_URL), is_critical=True
        ),
        EnvCheckItem(
            "TOKEN_ENCRYPTION_KEY",
            "AES-256 key for Google OAuth tokens at rest",
            bool(cfg.TOKEN_ENCRYPTION_KEY),
            is_critical=True,
        ),
        EnvCheckItem(
            "MCP_JWT_SECRET",
            "Cryptographic key for signing IDE MCP session tokens",
            bool(cfg.MCP_JWT_SECRET),
            is_critical=True,
        ),
        # Authentication (Critical unless DEV_MOCK_AUTH is True)
        EnvCheckItem(
            "CLERK_ISSUER",
            "Clerk authentication issuer",
            bool(cfg.CLERK_ISSUER or cfg.DEV_MOCK_AUTH),
            is_critical=not cfg.DEV_MOCK_AUTH,
        ),
        EnvCheckItem(
            "CLERK_JWKS_URL",
            "Clerk JWKS public key endpoint",
            bool(cfg.CLERK_JWKS_URL or cfg.DEV_MOCK_AUTH),
            is_critical=not cfg.DEV_MOCK_AUTH,
        ),
        # Optional Integrations
        EnvCheckItem(
            "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
            "Google Docs integration unconfigured",
            bool(cfg.GOOGLE_CLIENT_ID and cfg.GOOGLE_CLIENT_SECRET),
            is_critical=False,
        ),
        EnvCheckItem(
            "GEMINI_API_KEY",
            "AI summarizer running in deterministic fallback mode",
            bool(cfg.GEMINI_API_KEY),
            is_critical=False,
        ),
    ]

    missing_critical = [
        f"{c.name} ({c.description})" for c in checks if c.is_critical and not c.is_present
    ]
    missing_optional = [
        f"{c.name} ({c.description})" for c in checks if not c.is_critical and not c.is_present
    ]

    if missing_critical:
        for item in missing_critical:
            logger.error(f"[CONFIG CRITICAL] Missing essential environment variable: {item}")
    else:
        logger.info("[CONFIG OK] All essential environment variables are configured.")

    for item in missing_optional:
        logger.warning(f"[CONFIG NOTICE] Optional feature unconfigured: {item}")


settings = Settings()
