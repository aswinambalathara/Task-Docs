"""
Tethr MCP Service.
Handles authorization code issuance, OAuth token exchange and refresh, opaque MCP token
verification and revocation, and active SSE session mapping.
"""

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from beanie import PydanticObjectId
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.logger import logger
from app.core.security import decode_clerk_token
from app.models.mcp import MCPAccessToken, MCPAuthCode

AUTH_CODE_PREFIX = "td_auth_"
ACCESS_TOKEN_PREFIX = "tethr_at_"
REFRESH_TOKEN_PREFIX = "tethr_rt_"

# last_used_at is only rewritten this often, to avoid a DB write on every MCP request
LAST_USED_WRITE_INTERVAL = timedelta(minutes=5)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _as_utc(dt: datetime) -> datetime:
    # MongoDB returns naive datetimes; every stored value is UTC
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _invalid_grant(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class MCPService:
    """
    Business logic and security layer for Model Context Protocol (MCP) integrations.
    """

    # Active SSE sessions: session_id -> user_id.
    # Kept in memory on purpose: a classic SSE stream lives inside one server process,
    # so its session can only ever be served by the process holding it.
    _SSE_SESSIONS: dict[str, str] = {}

    @staticmethod
    async def create_authorization_code(
        user_id: str,
        client_id: str | None = None,
        redirect_uri: str | None = None,
        code_challenge: str | None = None,
        code_challenge_method: str | None = None,
        ttl_seconds: int | None = None,
    ) -> str:
        """
        Creates a short-lived, single-use authorization code for the authenticated user.
        Supports PKCE RFC 7636 (S256 only).
        """
        method = code_challenge_method or "S256"
        if code_challenge and method != "S256":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only the S256 PKCE code_challenge_method is supported.",
            )

        ttl = ttl_seconds or settings.MCP_AUTH_CODE_TTL_SECONDS
        code = f"{AUTH_CODE_PREFIX}{secrets.token_urlsafe(24)}"
        await MCPAuthCode(
            code_hash=_hash(code),
            user_id=user_id,
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_challenge=code_challenge,
            code_challenge_method=method if code_challenge else None,
            expires_at=datetime.now(UTC) + timedelta(seconds=ttl),
        ).insert()
        logger.info(f"Created MCP authorization code for user {user_id} ({client_id})")
        return code

    @staticmethod
    async def exchange_authorization_code(
        code: str,
        code_verifier: str | None = None,
        client_id: str | None = None,
        redirect_uri: str | None = None,
    ) -> MCPAuthCode:
        """
        Validates the authorization code (expiry, PKCE, client binding) and atomically
        marks it as redeemed. Returns the stored code record.
        """
        entry = await MCPAuthCode.find_one({"code_hash": _hash(code)})
        if not entry:
            raise _invalid_grant("Invalid or expired authorization code.")
        if entry.used:
            raise _invalid_grant("Authorization code has already been redeemed.")
        if _as_utc(entry.expires_at) < datetime.now(UTC):
            await entry.delete()
            raise _invalid_grant("Authorization code has expired.")

        # RFC 6749 §4.1.3: when supplied, client_id and redirect_uri must match the original request
        if client_id and entry.client_id and client_id != entry.client_id:
            raise _invalid_grant("Authorization code was issued to a different client.")
        if redirect_uri and entry.redirect_uri and redirect_uri != entry.redirect_uri:
            raise _invalid_grant("redirect_uri does not match the authorization request.")

        if entry.code_challenge:
            if not code_verifier:
                raise _invalid_grant("Missing PKCE code_verifier.")
            computed = (
                base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest())
                .decode()
                .rstrip("=")
            )
            if not secrets.compare_digest(computed, entry.code_challenge.rstrip("=")):
                raise _invalid_grant("Invalid PKCE code_verifier.")

        # Conditional update so two concurrent exchanges cannot both redeem the code
        result = await MCPAuthCode.get_motor_collection().update_one(
            {"_id": entry.id, "used": False}, {"$set": {"used": True}}
        )
        if result.modified_count != 1:
            raise _invalid_grant("Authorization code has already been redeemed.")

        logger.info(f"Redeemed MCP authorization code for user {entry.user_id}")
        return entry

    @staticmethod
    async def issue_tokens(user_id: str, client_name: str | None = None) -> dict[str, Any]:
        """
        Issues a new opaque access + refresh token pair. Only their hashes are stored.
        """
        access_token = f"{ACCESS_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
        refresh_token = f"{REFRESH_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
        now = datetime.now(UTC)
        await MCPAccessToken(
            user_id=user_id,
            access_token_hash=_hash(access_token),
            refresh_token_hash=_hash(refresh_token),
            client_name=client_name,
            access_expires_at=now + timedelta(seconds=settings.MCP_TOKEN_EXPIRATION_SECONDS),
            refresh_expires_at=now
            + timedelta(seconds=settings.MCP_REFRESH_TOKEN_EXPIRATION_SECONDS),
        ).insert()
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": settings.MCP_TOKEN_EXPIRATION_SECONDS,
            "user_id": user_id,
        }

    @staticmethod
    async def refresh_tokens(refresh_token: str) -> dict[str, Any]:
        """
        Rotates a refresh token: the old pair is revoked and a new pair is issued,
        so a leaked refresh token can be used at most once.
        """
        record = await MCPAccessToken.find_one({"refresh_token_hash": _hash(refresh_token)})
        now = datetime.now(UTC)
        if (
            not record
            or record.revoked_at is not None
            or _as_utc(record.refresh_expires_at) < now
        ):
            raise _invalid_grant("Invalid or expired refresh token.")

        result = await MCPAccessToken.get_motor_collection().update_one(
            {"_id": record.id, "revoked_at": None}, {"$set": {"revoked_at": now}}
        )
        if result.modified_count != 1:
            raise _invalid_grant("Invalid or expired refresh token.")

        return await MCPService.issue_tokens(record.user_id, record.client_name)

    @staticmethod
    async def _verify_access_token(token: str) -> str | None:
        record = await MCPAccessToken.find_one({"access_token_hash": _hash(token)})
        if not record or record.revoked_at is not None:
            return None

        now = datetime.now(UTC)
        if _as_utc(record.access_expires_at) < now:
            return None

        if record.last_used_at is None or now - _as_utc(record.last_used_at) > (
            LAST_USED_WRITE_INTERVAL
        ):
            record.last_used_at = now
            await record.save()
        return record.user_id

    @staticmethod
    async def verify_mcp_token_string(token: str) -> str | None:
        """
        Validates an MCP bearer token (Tethr access token, Clerk RS256 JWT, or a dev mock
        token) and returns the user_id, or None if it is not valid.
        """
        if not token:
            return None

        # 1. Opaque Tethr MCP access token issued by /token
        if token.startswith(ACCESS_TOKEN_PREFIX):
            return await MCPService._verify_access_token(token)

        # 2. Clerk RS256 JWT (same verification as the REST API, including `azp`)
        try:
            return decode_clerk_token(token).get("sub")
        except Exception:
            pass

        # 3. Dev mock bypass (ONLY enabled in tests / when DEV_MOCK_AUTH=True)
        if settings.DEV_MOCK_AUTH and (
            token.startswith("mock_")
            or token.startswith("usr_")
            or token.startswith("user_")
            or token == "test_token"
            or token == "clerk_mock_user_123"
        ):
            return token if token != "test_token" else "user_mock_dev_alex"

        return None

    @staticmethod
    async def list_connections(user_id: str) -> list[MCPAccessToken]:
        return (
            await MCPAccessToken.find({"user_id": user_id, "revoked_at": None})
            .sort("-created_at")
            .to_list()
        )

    @staticmethod
    async def revoke_connection(user_id: str, connection_id: str) -> bool:
        """
        Revokes an AI editor connection owned by user_id. Returns False if not found.
        """
        try:
            obj_id = PydanticObjectId(connection_id)
        except Exception:
            return False

        record = await MCPAccessToken.find_one(
            {"_id": obj_id, "user_id": user_id, "revoked_at": None}
        )
        if not record:
            return False

        record.revoked_at = datetime.now(UTC)
        await record.save()
        logger.info(f"Revoked MCP connection {connection_id} for user {user_id}")
        return True

    @classmethod
    def register_sse_session(cls, session_id: str, user_id: str) -> None:
        cls._SSE_SESSIONS[session_id] = user_id

    @classmethod
    def get_sse_session_user(cls, session_id: str) -> str | None:
        return cls._SSE_SESSIONS.get(session_id)

    @classmethod
    def get_client_configs(cls) -> dict[str, Any]:
        """
        Returns pre-formatted JSON setup snippets using the configured MCP SSE URL.
        """
        sse_url = settings.effective_mcp_sse_url
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
