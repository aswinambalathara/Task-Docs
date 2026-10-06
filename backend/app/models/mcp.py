from datetime import UTC, datetime
from typing import Annotated

import pymongo
from beanie import Document, Indexed
from pydantic import Field
from pymongo import IndexModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class MCPAuthCode(Document):
    """
    Short-lived, single-use OAuth authorization code issued by /auth/mcp.
    Only the SHA-256 hash of the code is stored; MongoDB's TTL index purges expired codes.
    """

    code_hash: Annotated[str, Indexed(unique=True)]
    user_id: str
    client_id: str | None = None
    redirect_uri: str | None = None
    code_challenge: str | None = None
    code_challenge_method: str | None = None
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=utc_now)

    class Settings:
        name = "mcp_auth_codes"
        indexes = [IndexModel([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0)]


class MCPAccessToken(Document):
    """
    An AI editor connection: opaque access + refresh token pair (stored as SHA-256 hashes).
    Revoking the record immediately disconnects the editor.
    """

    user_id: Annotated[str, Indexed()]
    access_token_hash: Annotated[str, Indexed(unique=True)]
    refresh_token_hash: Annotated[str, Indexed(unique=True)]
    client_name: str | None = None
    access_expires_at: datetime
    refresh_expires_at: datetime
    created_at: datetime = Field(default_factory=utc_now)
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None

    class Settings:
        name = "mcp_access_tokens"
        indexes = [IndexModel([("refresh_expires_at", pymongo.ASCENDING)], expireAfterSeconds=0)]
