"""
Tethr MCP Middleware.
Provides streaming-safe ASGI middleware for authenticating MCP clients,
mapping SSE sessions to user accounts, and injecting multi-tenant context.
"""

from urllib.parse import parse_qs

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings
from app.mcp.server import current_mcp_user_var
from app.services.mcp_service import MCPService


def is_mcp_path(path: str) -> bool:
    return path in ("/sse", "/mcp") or path.startswith("/messages")


class MCPAuthContextMiddleware:
    """
    Streaming-safe ASGI middleware that extracts user authorization from
    the Authorization header or ?token= query parameter, maps SSE session IDs,
    and sets the active multi-tenant user in current_mcp_user_var.
    Only MCP transport paths are handled; REST routes authenticate via get_current_user.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http" or not is_mcp_path(scope.get("path", "")):
            await self.app(scope, receive, send)
            return

        token = None
        user_id = None

        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization", b"").decode("utf-8", errors="ignore")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()

        query_string = scope.get("query_string", b"").decode("utf-8", errors="ignore")
        params = parse_qs(query_string)
        if not token:
            token = params.get("token", [None])[0] or params.get("access_token", [None])[0]

        if token:
            user_id = await MCPService.verify_mcp_token_string(token)

        session_id = params.get("session_id", [None])[0] or params.get("sessionId", [None])[0]
        if user_id and session_id:
            MCPService.register_sse_session(session_id, user_id)
        elif not user_id and session_id:
            user_id = MCPService.get_sse_session_user(session_id)

        # Unauthenticated: challenge with a 401 pointing at the OAuth discovery metadata,
        # which is what makes AI editors start the browser login flow
        if not user_id and scope.get("method", "GET") != "OPTIONS":
            response = JSONResponse(
                content={
                    "error": "unauthorized",
                    "message": "Authentication required. Please authorize via OAuth in your browser.",
                },
                status_code=401,
                headers={
                    "WWW-Authenticate": (
                        f'Bearer resource_metadata="{settings.BACKEND_URL}'
                        '/.well-known/oauth-protected-resource/sse"'
                    )
                },
            )
            await response(scope, receive, send)
            return

        if user_id:
            try:
                from mcp.server.auth.middleware.bearer_auth import AuthenticatedUser
                from mcp.server.auth.provider import AccessToken

                scope["user"] = AuthenticatedUser(
                    AccessToken(token=token or "", client_id=user_id, scopes=[])
                )
            except Exception:
                pass

        ctx_token = current_mcp_user_var.set(user_id)
        try:
            await self.app(scope, receive, send)
        finally:
            current_mcp_user_var.reset(ctx_token)
