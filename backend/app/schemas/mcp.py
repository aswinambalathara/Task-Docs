"""
TaskDocs / Tethr MCP API Schemas.
Pydantic models for MCP authorization, token exchange, and client configurations.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AuthorizeRequest(BaseModel):
    client_id: str | None = Field(default="AI Editor", description="Name of the requesting IDE")
    redirect_uri: str | None = Field(default=None, description="IDE redirect URI scheme")
    state: str | None = Field(default=None, description="Optional OAuth state")
    code_challenge: str | None = Field(default=None, description="PKCE code challenge (RFC 7636)")
    code_challenge_method: str | None = Field(default="S256", description="PKCE code challenge method")


class AuthorizeResponse(BaseModel):
    code: str
    expires_in: int = 600
    redirect_uri: str | None = None
    state: str | None = None
    user_id: str


class TokenRequest(BaseModel):
    grant_type: str = Field(default="authorization_code")
    code: str | None = Field(default=None, description="Authorization code from /auth/mcp")
    client_id: str | None = Field(default=None)
    redirect_uri: str | None = Field(default=None)
    code_verifier: str | None = Field(default=None, description="PKCE code verifier (RFC 7636)")
    refresh_token: str | None = Field(default=None, description="For grant_type=refresh_token")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    refresh_token: str
    user_id: str
    expires_in: int = 2592000


class MCPConnectionResponse(BaseModel):
    id: str
    client_name: str | None = None
    created_at: datetime
    last_used_at: datetime | None = None
    access_expires_at: datetime


class MCPSessionResponse(BaseModel):
    authenticated: bool = True
    user_id: str
    mode: str | None = None


class MCPConfigResponse(BaseModel):
    sse_endpoint: str
    recommended_clients: dict[str, Any]
