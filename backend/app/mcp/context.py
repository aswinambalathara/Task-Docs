"""
Tethr MCP Context Management.
Provides context variables and resolution logic for isolating multi-tenant user identity
across asynchronous FastMCP tool executions and streaming SSE connections.
"""

import contextvars

from app.core.config import settings

# Context variable holding the authenticated user ID for the current MCP session/request
current_mcp_user_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_mcp_user_var", default=None
)


def get_current_mcp_user_id() -> str:
    """
    Resolves the authenticated user ID for the active MCP invocation.
    Prioritizes contextvar, falls back to dev mock user if configured, or raises ValueError.
    """
    user_id = current_mcp_user_var.get()
    if user_id:
        return user_id

    # Check FastMCP internal auth context if available
    try:
        from mcp.server.auth.middleware.auth_context import auth_context_var

        auth_user = auth_context_var.get()
        if auth_user and auth_user.access_token:
            token_sub = getattr(auth_user.access_token, "client_id", None) or getattr(
                auth_user.access_token, "sub", None
            )
            if token_sub:
                return token_sub
    except Exception:
        pass

    if settings.DEV_MOCK_AUTH:
        return "user_mock_dev_alex"

    raise ValueError("Unauthorized: No authenticated user session found in MCP request context.")
