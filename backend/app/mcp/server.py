"""
Tethr FastMCP Server.
Configures and initializes the FastMCP Server for AI editors (Antigravity, Cursor, Claude Code, Windsurf)
with strict multi-tenant isolation, transport security, and modular tool registration.
"""

from urllib.parse import urlparse

from mcp.server.fastmcp import FastMCP

from app.core.config import settings

from app.mcp.context import current_mcp_user_var, get_current_mcp_user_id
from app.mcp.tools import add_task, get_tasks, register_tools, sync_docs, update_task

# Initialize FastMCP Server
mcp = FastMCP(
    name="Tethr",
    instructions=(
        "Tethr MCP Server enables AI programming assistants to track engineering tasks, "
        "log granular contribution notes, highlight appraisal-worthy achievements, "
        "and synchronize impact ledgers directly to Google Docs."
    ),
)

# Ensure local development hosts and test servers are allowed in transport security
for host in [
    "testserver",
    "testserver:*",
    "127.0.0.1",
    "127.0.0.1:*",
    "localhost",
    "localhost:*",
    "[::1]",
    "[::1]:*",
]:
    if host not in mcp.settings.transport_security.allowed_hosts:
        mcp.settings.transport_security.allowed_hosts.append(host)

# Allow the configured public backend hosts (e.g. api.example.com) behind DNS rebinding protection
for url in (settings.BACKEND_URL, settings.effective_mcp_sse_url):
    netloc = urlparse(url).netloc
    if netloc and netloc not in mcp.settings.transport_security.allowed_hosts:
        mcp.settings.transport_security.allowed_hosts.append(netloc)

# Register modular tools onto FastMCP instance
register_tools(mcp)

__all__ = [
    "mcp",
    "current_mcp_user_var",
    "get_current_mcp_user_id",
    "add_task",
    "update_task",
    "get_tasks",
    "sync_docs",
    "register_tools",
]
