"""Main MCP server entry point with all integrations."""

import logging

from fastmcp import FastMCP

from .config import settings
from .logging_config import setup_logging
from .integrations import (
    register_postgres_tools,
    register_fastapi_tools,
    register_playwright_tools,
)

# Setup logging before anything else
setup_logging()
logger = logging.getLogger(__name__)

# Create the unified MCP server
mcp = FastMCP(
    name="App Dev MCP Server",
    description="Unified MCP server with PostgreSQL, FastAPI, and Playwright integrations for AI-assisted development",
)

# Register all integration tools
register_postgres_tools(mcp)
register_fastapi_tools(mcp)
register_playwright_tools(mcp)


def main():
    """Run the MCP server."""
    logger.info(f"Starting MCP server on port {settings.mcp_port}")
    mcp.run(transport="sse", port=settings.mcp_port)


if __name__ == "__main__":
    main()
