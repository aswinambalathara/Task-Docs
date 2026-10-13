"""
Tethr MCP API Router.
Handles endpoints for IDE authorization code generation, token exchange and refresh,
session verification, connection revocation, and recommended client setup configurations.
"""

import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.responses import RedirectResponse

from app.core.config import settings
from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.mcp import (
    AuthorizeRequest,
    AuthorizeResponse,
    MCPConfigResponse,
    MCPConnectionResponse,
    MCPSessionResponse,
    TokenRequest,
    TokenResponse,
)
from app.services.mcp_auth import MCPService

router = APIRouter()
optional_bearer_scheme = HTTPBearer(auto_error=False)


# --- Endpoints ---


@router.get(
    "/authorize",
    summary="OAuth Authorization Endpoint (Browser Redirect to Frontend)",
)
async def oauth_authorize_redirect(
    request: Request,
):
    """
    Redirects incoming IDE browser authorization requests to the frontend /auth/mcp UI,
    preserving all OAuth/PKCE query parameters (client_id, redirect_uri, state, code_challenge).
    """
    query = request.query_string.decode("utf-8", errors="ignore")
    return RedirectResponse(url=f"{settings.oauth_authorization_url}?{query}")


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
    code = await MCPService.create_authorization_code(
        user_id=current_user.id,
        client_id=payload.client_id,
        redirect_uri=payload.redirect_uri,
        code_challenge=payload.code_challenge,
        code_challenge_method=payload.code_challenge_method,
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
    summary="Exchange Authorization Code or Refresh Token for MCP Tokens",
)
async def exchange_token(request: Request):
    """
    OAuth token endpoint called by AI editors.
    - grant_type=authorization_code: exchanges a one-time code (with PKCE verifier) for tokens.
    - grant_type=refresh_token: rotates a refresh token into a new token pair.
    Accepts application/x-www-form-urlencoded (OAuth standard) and application/json.
    """
    content_type = request.headers.get("content-type", "")
    try:
        if "application/x-www-form-urlencoded" in content_type:
            raw = {k: str(v) for k, v in (await request.form()).items()}
        else:
            raw = await request.json()
        payload = TokenRequest(**raw)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed token request."
        ) from exc

    if payload.grant_type == "refresh_token":
        if not payload.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Missing refresh_token."
            )
        tokens = await MCPService.refresh_tokens(payload.refresh_token)
    elif payload.grant_type == "authorization_code":
        if not payload.code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code.",
            )
        entry = await MCPService.exchange_authorization_code(
            payload.code,
            code_verifier=payload.code_verifier,
            client_id=payload.client_id,
            redirect_uri=payload.redirect_uri,
        )
        tokens = await MCPService.issue_tokens(entry.user_id, client_name=entry.client_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported grant_type '{payload.grant_type}'.",
        )

    return TokenResponse(token_type="Bearer", **tokens)


@router.post(
    "/register",
    summary="Dynamic Client Registration (RFC 7591)",
)
async def register_mcp_client(request: Request):
    """
    Handles dynamic client registration for AI IDEs requesting OAuth integration.
    IDEs are public clients (no secret); security comes from PKCE, so nothing is stored.
    """
    try:
        data = await request.json()
    except Exception:
        data = {}

    client_id = f"mcp_ide_{secrets.token_hex(8)}"
    return {
        "client_id": client_id,
        "client_id_issued_at": int(time.time()),
        "client_name": data.get("client_name", "AI IDE"),
        "redirect_uris": data.get("redirect_uris", []),
        "grant_types": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_method": "none",
    }


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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing MCP authentication token.",
        )

    user_id = await MCPService.verify_mcp_token_string(raw_token)
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
    "/connections",
    response_model=list[MCPConnectionResponse],
    summary="List Connected AI Editors",
)
async def list_mcp_connections(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Lists the user's active AI editor connections (one per issued token pair).
    """
    records = await MCPService.list_connections(current_user.id)
    return [
        MCPConnectionResponse(
            id=str(r.id),
            client_name=r.client_name,
            created_at=r.created_at,
            last_used_at=r.last_used_at,
            access_expires_at=r.access_expires_at,
        )
        for r in records
    ]


@router.delete(
    "/connections/{connection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an AI Editor Connection",
)
async def revoke_mcp_connection(
    connection_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Revokes an AI editor connection; its access and refresh tokens stop working immediately.
    """
    revoked = await MCPService.revoke_connection(current_user.id, connection_id)
    if not revoked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found")
    return None


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
        sse_endpoint=settings.effective_mcp_sse_url,
        recommended_clients=MCPService.get_client_configs(),
    )
