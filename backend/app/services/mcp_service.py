"""
Tethr MCP Service.
Handles authorization code issuance, OAuth token exchange, signed MCP JWT verification,
and active SSE session mapping.
"""

import secrets
import time
from typing import Any

import jwt
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.logger import logger
from app.core.security import get_jwks_client


class MCPService:
    """
    Business logic and security layer for Model Context Protocol (MCP) integrations.
    """

    # In-memory storage for short-lived authorization codes: code -> metadata
    _AUTH_CODES: dict[str, dict[str, Any]] = {}

    # Active SSE sessions: session_id -> user_id
    _SSE_SESSIONS: dict[str, str] = {}

    @classmethod
    def _cleanup_expired_codes(cls) -> None:
        now = time.time()
        expired = [k for k, v in cls._AUTH_CODES.items() if v["expires_at"] < now or v.get("used")]
        for k in expired:
            cls._AUTH_CODES.pop(k, None)

    @classmethod
    def create_authorization_code(
        cls,
        user_id: str,
        client_id: str | None = None,
        redirect_uri: str | None = None,
        ttl_seconds: int | None = None,
    ) -> str:
        """
        Creates a short-lived, single-use authorization code for the authenticated user.
        """
        cls._cleanup_expired_codes()
        ttl = ttl_seconds or settings.MCP_AUTH_CODE_TTL_SECONDS
        code = f"td_auth_{secrets.token_urlsafe(24)}"
        cls._AUTH_CODES[code] = {
            "user_id": user_id,
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "expires_at": time.time() + ttl,
            "used": False,
        }
        logger.info(f"Created MCP authorization code for user {user_id} ({client_id})")
        return code

    @classmethod
    def exchange_authorization_code(cls, code: str) -> str:
        """
        Validates and marks the authorization code as redeemed, returning the user_id.
        """
        cls._cleanup_expired_codes()
        entry = cls._AUTH_CODES.get(code)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired authorization code.",
            )
        if entry.get("used"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code has already been redeemed.",
            )
        if entry["expires_at"] < time.time():
            cls._AUTH_CODES.pop(code, None)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code has expired.",
            )

        entry["used"] = True
        logger.info(f"Redeemed MCP authorization code for user {entry['user_id']}")
        return entry["user_id"]

    @classmethod
    def generate_mcp_token(cls, user_id: str, expires_in_seconds: int | None = None) -> str:
        """
        Generates a signed HS256 JWT bearer token for the IDE MCP client.
        """
        if not settings.MCP_JWT_SECRET:
            logger.error("Cannot issue MCP token: MCP_JWT_SECRET is not configured in .env.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: MCP_JWT_SECRET is not configured.",
            )

        now = int(time.time())
        expires_in = expires_in_seconds or settings.MCP_TOKEN_EXPIRATION_SECONDS
        payload = {
            "sub": user_id,
            "iss": "Tethr-MCP",
            "iat": now,
            "exp": now + expires_in,
            "type": "mcp_bearer_token",
        }
        return jwt.encode(payload, settings.MCP_JWT_SECRET, algorithm="HS256")

    @classmethod
    def verify_mcp_token_string(cls, token: str) -> str | None:
        """
        Validates any MCP token (signed HS256, Clerk RS256, or dev mock token) and returns the user_id.
        """
        if not token:
            return None

        # 1. Dev mock bypass
        if settings.DEV_MOCK_AUTH and (
            token.startswith("mock_")
            or token.startswith("usr_")
            or token.startswith("user_")
            or token == "test_token"
            or token == "clerk_mock_user_123"
        ):
            return token if token != "test_token" else "user_mock_dev_alex"

        # 2. Signed HS256 MCP JWT
        if settings.MCP_JWT_SECRET:
            try:
                payload = jwt.decode(token, settings.MCP_JWT_SECRET, algorithms=["HS256"])
                user_id = payload.get("sub")
                if user_id:
                    return user_id
            except Exception:
                pass

        # 3. Clerk RS256 JWT validation
        try:
            jwks_client = get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=settings.CLERK_ISSUER,
                options={"verify_exp": True, "verify_iss": True},
            )
            return payload.get("sub")
        except Exception:
            pass

        if settings.DEV_MOCK_AUTH:
            return "user_mock_dev_alex"

        return None

    @classmethod
    def register_sse_session(cls, session_id: str, user_id: str) -> None:
        cls._SSE_SESSIONS[session_id] = user_id

    @classmethod
    def get_sse_session_user(cls, session_id: str) -> str | None:
        return cls._SSE_SESSIONS.get(session_id)

    @classmethod
    def get_client_configs(cls) -> dict[str, Any]:
        """
        Returns pre-formatted JSON setup snippets using the configured MCP_SSE_URL.
        """
        sse_url = settings.MCP_SSE_URL
        return {
            "antigravity": {
                "name": "Tethr Antigravity Setup",
                "instructions": "In Antigravity settings or .agents/mcp_config.json, add:",
                "config": {
                    "mcpServers": {
                        "tethr": {
                            "url": sse_url,
                            "transport": "sse",
                            "headers": {"Authorization": "Bearer <YOUR_MCP_TOKEN>"},
                        }
                    }
                },
            },
            "cursor": {
                "name": "Cursor IDE Setup",
                "instructions": "In Cursor Settings -> Features -> MCP -> Add new MCP server:",
                "config": {
                    "name": "Tethr",
                    "type": "sse",
                    "url": sse_url,
                    "headers": {"Authorization": "Bearer <YOUR_MCP_TOKEN>"},
                },
            },
            "claude_code": {
                "name": "Claude Code CLI Setup",
                "instructions": f"Run command: claude mcp add --transport sse tethr {sse_url}",
            },
        }
