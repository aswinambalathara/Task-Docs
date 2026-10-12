"""
FastMCP ASGI Adapter & Mounting.
Handles dual-protocol transport (Classic SSE + Streamable HTTP) and provides connection disconnect protection.
"""

import contextlib
from typing import Any

from fastapi import FastAPI
from starlette.types import Receive, Scope, Send

from app.mcp.middleware import MCPAuthContextMiddleware
from app.mcp.server import mcp


def create_mcp_hybrid_app(sse_subapp: Any, http_subapp: Any):
    """
    Creates an ASGI hybrid application wrapper that:
    1. Sends `/mcp` to the Streamable HTTP app (whose own route is `/mcp`).
    2. Reroutes POST requests directed to `/sse` internally to modern Streamable HTTP `/mcp`.
    3. Intercepts and safely suppresses duplicate headers or broken pipe errors caused by client disconnects.
    """
    async def mcp_hybrid_app(scope: Scope, receive: Receive, send: Send):
        if scope.get("type") == "http":
            path = scope.get("path", "")
            method = scope.get("method", "GET")

            if path == "/mcp":
                await http_subapp(scope, receive, send)
                return

            # Route POST /sse to Streamable HTTP handler
            if path == "/sse" and method == "POST":
                new_scope = dict(scope)
                new_scope["path"] = "/mcp"
                new_scope["raw_path"] = b"/mcp"
                await http_subapp(new_scope, receive, send)
                return

            response_started = False
            duplicate_response = False

            async def safe_send(message: dict[str, Any]):
                nonlocal response_started, duplicate_response
                msg_type = message.get("type")
                if msg_type == "http.response.start":
                    if response_started:
                        # Drop duplicate response start triggered by FastMCP route return on shutdown/disconnect
                        duplicate_response = True
                        return
                    response_started = True
                elif duplicate_response:
                    # Drop any body parts emitted for the duplicate response
                    return

                # Connection dropped by client or during server shutdown
                with contextlib.suppress(Exception):
                    await send(message)

            with contextlib.suppress(Exception):
                await sse_subapp(scope, receive, safe_send)
            return

        await sse_subapp(scope, receive, send)

    return mcp_hybrid_app


def setup_mcp_mounting(app: FastAPI) -> None:
    """
    Mounts FastMCP dual-protocol ASGI sub-applications and registers streaming authentication middleware.
    """
    sse_subapp = mcp.sse_app()
    http_subapp = mcp.streamable_http_app()
    hybrid_app = create_mcp_hybrid_app(sse_subapp, http_subapp)

    # Root ASGI app for /sse, /messages (classic SSE) and /mcp (Streamable HTTP).
    # Mounted last-resort at "" so the REST and OAuth routers registered earlier take precedence.
    app.mount("", hybrid_app)

    # Add streaming-safe ASGI MCP authentication middleware
    app.add_middleware(MCPAuthContextMiddleware)
