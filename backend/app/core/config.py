import json
from typing import NamedTuple

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Tethr API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Application Base URLs
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    # MongoDB Atlas Settings
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "tethr_dev"

    # Clerk Authentication
    CLERK_ISSUER: str = ""
    CLERK_JWKS_URL: str = ""
    # Frontend origins whose Clerk tokens are accepted (checked against the `azp` claim).
    # Empty = use CORS_ORIGINS.
    CLERK_AUTHORIZED_PARTIES: list[str] = []
    DEV_MOCK_AUTH: bool = False  # Allows offline/dev mode without requiring live Clerk network calls

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
    # Max AI previews per user per UTC day billed to GEMINI_API_KEY (BYOK requests are not counted)
    AI_PREVIEW_DAILY_LIMIT: int = 5

    # Logging Configuration
    LOG_DIR: str = "logs"
    LOG_LEVEL: str = "INFO"
    LOG_RETENTION_DAYS: int = 7
    LOG_ROTATION: str = "20 MB"

    # Model Context Protocol (MCP) Configuration
    MCP_SSE_URL: str = ""
    MCP_AUTH_CODE_TTL_SECONDS: int = 600  # 10 minutes
    MCP_TOKEN_EXPIRATION_SECONDS: int = 2592000  # 30 days
    MCP_REFRESH_TOKEN_EXPIRATION_SECONDS: int = 7776000  # 90 days

    # Scheduled Google Docs syncs (in-process scheduler loop)
    AUTO_SYNC_ENABLED: bool = True

    # CORS configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @property
    def effective_mcp_sse_url(self) -> str:
        return self.MCP_SSE_URL or f"{self.BACKEND_URL}/sse"

    @property
    def clerk_authorized_parties(self) -> set[str]:
        parties = self.CLERK_AUTHORIZED_PARTIES or self.CORS_ORIGINS
        return {p.rstrip("/") for p in parties}

    @property
    def oauth_resource_url(self) -> str:
        return f"{self.BACKEND_URL}/sse"

    @property
    def oauth_issuer_url(self) -> str:
        return self.BACKEND_URL

    @property
    def oauth_authorization_url(self) -> str:
        return f"{self.FRONTEND_URL}/auth/mcp"

    @property
    def oauth_token_url(self) -> str:
        return f"{self.BACKEND_URL}{self.API_V1_STR}/mcp/token"

    @property
    def oauth_registration_url(self) -> str:
        return f"{self.BACKEND_URL}{self.API_V1_STR}/mcp/register"

    @field_validator("CORS_ORIGINS", "CLERK_AUTHORIZED_PARTIES", mode="before")
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

    @model_validator(mode="after")
    def forbid_mock_auth_in_production(self) -> "Settings":
        # DEV_MOCK_AUTH accepts any token that fails Clerk validation, so it must never reach production
        if self.DEV_MOCK_AUTH and self.ENVIRONMENT.lower() == "production":
            raise ValueError("DEV_MOCK_AUTH must be False when ENVIRONMENT=production.")
        return self

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
