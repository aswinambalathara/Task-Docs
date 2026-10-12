"""
OAuth 2.0 Discovery & Metadata Router (RFC 9728 / RFC 8414).
Provides metadata endpoints and root aliases for Model Context Protocol (MCP) clients.
All endpoint URLs are dynamically resolved from application environment settings.
"""

from fastapi import APIRouter

from app.api.v1.mcp import exchange_token, oauth_authorize_redirect, register_mcp_client
from app.core.config import settings

oauth_router = APIRouter(tags=["OAuth & MCP Discovery"])


@oauth_router.get("/.well-known/oauth-protected-resource", include_in_schema=False)
@oauth_router.get("/.well-known/oauth-protected-resource/sse", include_in_schema=False)
async def oauth_protected_resource_metadata():
    """
    OAuth 2.0 Protected Resource Metadata (RFC 9728).
    Enables AI IDEs and MCP clients to discover the authorization server protecting the SSE/MCP stream.
    """
    return {
        "resource": settings.oauth_resource_url,
        "authorization_servers": [settings.oauth_issuer_url],
        "bearer_methods_supported": ["header"],
        "scopes_supported": ["mcp"],
    }


@oauth_router.get("/.well-known/oauth-authorization-server", include_in_schema=False)
async def oauth_authorization_server_metadata():
    """
    OAuth 2.0 Authorization Server Metadata (RFC 8414).
    Advertises OAuth endpoints and supported capabilities for seamless IDE auto-configuration.
    """
    return {
        "issuer": settings.oauth_issuer_url,
        "authorization_endpoint": settings.oauth_authorization_url,
        "token_endpoint": settings.oauth_token_url,
        "registration_endpoint": settings.oauth_registration_url,
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        # IDEs are public clients: no client secret, PKCE proves possession instead
        "token_endpoint_auth_methods_supported": ["none"],
    }


# Mount root aliases for direct OAuth callers and AI IDE clients
oauth_router.add_api_route("/token", exchange_token, methods=["POST"], include_in_schema=False)
oauth_router.add_api_route("/authorize", oauth_authorize_redirect, methods=["GET"], include_in_schema=False)
oauth_router.add_api_route("/register", register_mcp_client, methods=["POST"], include_in_schema=False)
