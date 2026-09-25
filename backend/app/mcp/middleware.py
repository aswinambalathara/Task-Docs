"""
Tethr MCP Middleware.
Provides streaming-safe ASGI middleware for authenticating MCP clients,
mapping SSE sessions to user accounts, and injecting multi-tenant context.
"""

from urllib.parse import parse_qs

from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings
from app.mcp.server import current_mcp_user_var
from app.services.mcp_service import MCPService


class MCPAuthContextMiddleware:
    """
    Streaming-safe ASGI middleware that extracts user authorization from
    the Authorization header or ?token= query parameter, maps SSE session IDs,
    and sets the active multi-tenant user in current_mcp_user_var.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            auth_header = headers.get(b"authorization", b"").decode("utf-8", errors="ignore")
            token = None
            if auth_header.lower().startswith("bearer "):
                token = auth_header[7:].strip()

            query_string = scope.get("query_string", b"").decode("utf-8", errors="ignore")
            params = parse_qs(query_string)
            if not token:
                token_val = params.get("token", [None])[0] or params.get("access_token", [None])[0]
                if token_val:
                    token = token_val

            user_id = None
            if token:
                user_id = MCPService.verify_mcp_token_string(token)

            session_id = params.get("sessionId", [None])[0]
            if user_id and session_id:
                MCPService.register_sse_session(session_id, user_id)
            elif not user_id and session_id:
                user_id = MCPService.get_sse_session_user(session_id)

            if not user_id and settings.DEV_MOCK_AUTH:
                user_id = "user_mock_dev_alex"

            ctx_token = current_mcp_user_var.set(user_id)
            try:
                await self.app(scope, receive, send)
            finally:
                current_mcp_user_var.reset(ctx_token)
        else:
            await self.app(scope, receive, send)
