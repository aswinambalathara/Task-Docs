"""
Tethr MCP API Router.
Handles endpoints for IDE authorization code generation, token exchange,
session verification, and recommended client setup configurations.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.mcp import (
    AuthorizeRequest,
    AuthorizeResponse,
    MCPConfigResponse,
    MCPSessionResponse,
    TokenRequest,
    TokenResponse,
)
from app.services.mcp_service import MCPService

router = APIRouter()
optional_bearer_scheme = HTTPBearer(auto_error=False)


# --- Endpoints ---


@router.post(
    "/authorize",
    response_model=AuthorizeResponse,
    summary="Generate One-Time MCP Authorization Code",
)
async def authorize_mcp_client(
    payload: AuthorizeRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Generates a secure, 10-minute one-time authorization code for the currently authenticated user.
    Used by the custom /auth/mcp frontend page.
    """
    code = MCPService.create_authorization_code(
        user_id=current_user.id,
        client_id=payload.client_id,
        redirect_uri=payload.redirect_uri,
    )
    return AuthorizeResponse(
        code=code,
        expires_in=settings.MCP_AUTH_CODE_TTL_SECONDS,
        redirect_uri=payload.redirect_uri,
        state=payload.state,
        user_id=current_user.id,
    )


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Exchange Authorization Code for MCP Access Token",
)
async def exchange_token(payload: TokenRequest):
    """
    Exchanges a one-time authorization code for a persistent 30-day MCP Bearer token.
    Called by AI editors during OAuth flow or manual code entry.
    """
    user_id = MCPService.exchange_authorization_code(payload.code)
    access_token = MCPService.generate_mcp_token(user_id)
    return TokenResponse(
        access_token=access_token,
        token_type="Bearer",
        user_id=user_id,
        expires_in=settings.MCP_TOKEN_EXPIRATION_SECONDS,
    )


@router.get(
    "/me",
    response_model=MCPSessionResponse,
    summary="Verify Active MCP Session",
)
async def verify_mcp_session(
    token: str | None = Query(default=None, description="Optional token parameter"),
    credentials: HTTPAuthorizationCredentials | None = Security(optional_bearer_scheme),
):
    """
    Validates token passed via Bearer header or ?token= query parameter and returns user info.
    """
    raw_token = (credentials.credentials if credentials else None) or token
    if not raw_token:
        if settings.DEV_MOCK_AUTH:
            return MCPSessionResponse(
                authenticated=True, user_id="user_mock_dev_alex", mode="dev_mock"
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing MCP authentication token.",
        )

    user_id = MCPService.verify_mcp_token_string(raw_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired MCP access token.",
        )

    return MCPSessionResponse(
        authenticated=True,
        user_id=user_id,
    )


@router.get(
    "/config",
    response_model=MCPConfigResponse,
    summary="Get MCP Client Configuration Snippets",
)
async def get_mcp_config():
    """
    Returns pre-formatted JSON configurations for Antigravity, Cursor, and Claude Code
    pointing to the configured MCP SSE endpoint.
    """
    return MCPConfigResponse(
        sse_endpoint=settings.MCP_SSE_URL,
        recommended_clients=MCPService.get_client_configs(),
    )
