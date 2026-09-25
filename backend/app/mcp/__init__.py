"""
Tethr FastMCP Server Package.
Provides MCP tools, session middleware, and context resolution for IDE integration.
"""

from app.mcp.context import current_mcp_user_var, get_current_mcp_user_id
from app.mcp.middleware import MCPAuthContextMiddleware
from app.mcp.server import mcp
from app.mcp.tools import register_tools

__all__ = [
    "mcp",
    "MCPAuthContextMiddleware",
    "current_mcp_user_var",
    "get_current_mcp_user_id",
    "register_tools",
]
