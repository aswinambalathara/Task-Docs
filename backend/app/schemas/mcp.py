"""
TaskDocs / Tethr MCP API Schemas.
Pydantic models for MCP authorization, token exchange, and client configurations.
"""

from typing import Any

from pydantic import BaseModel, Field


class AuthorizeRequest(BaseModel):
    client_id: str | None = Field(default="AI Editor", description="Name of the requesting IDE")
    redirect_uri: str | None = Field(default=None, description="IDE redirect URI scheme")
    state: str | None = Field(default=None, description="Optional OAuth state")


class AuthorizeResponse(BaseModel):
    code: str
    expires_in: int = 600
    redirect_uri: str | None = None
    state: str | None = None
    user_id: str


class TokenRequest(BaseModel):
    code: str = Field(..., description="The authorization code obtained from /auth/mcp")
    client_id: str | None = Field(default=None)
    grant_type: str = Field(default="authorization_code")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user_id: str
    expires_in: int = 2592000


class MCPSessionResponse(BaseModel):
    authenticated: bool = True
    user_id: str
    mode: str | None = None


class MCPConfigResponse(BaseModel):
    sse_endpoint: str
    recommended_clients: dict[str, Any]
