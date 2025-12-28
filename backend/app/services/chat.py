"""Chat service using OpenAI with function calling for tool integration."""

import json
import logging
import time
from typing import Any

import asyncpg
import httpx
from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

# Database connection pool
_db_pool: asyncpg.Pool | None = None


async def get_db_pool() -> asyncpg.Pool:
    """Get or create database connection pool."""
    global _db_pool
    if _db_pool is None:
        # Convert SQLAlchemy URL to asyncpg format
        db_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        _db_pool = await asyncpg.create_pool(db_url)
    return _db_pool


# Define the tools available for function calling
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_box",
            "description": "Create a 3D box/cube in the CAD scene. Use this when the user asks to create a box, cube, or rectangular shape.",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {
                        "type": "number",
                        "description": "X position of the box center (default: 0)",
                        "default": 0,
                    },
                    "y": {
                        "type": "number",
                        "description": "Y position (height) of the box base (default: 0)",
                        "default": 0,
                    },
                    "z": {
                        "type": "number",
                        "description": "Z position of the box center (default: 0)",
                        "default": 0,
                    },
                    "width": {
                        "type": "number",
                        "description": "Width of the box in X direction (default: 24 inches / 2 feet)",
                        "default": 24,
                    },
                    "height": {
                        "type": "number",
                        "description": "Height of the box in Y direction (default: 24 inches / 2 feet)",
                        "default": 24,
                    },
                    "depth": {
                        "type": "number",
                        "description": "Depth of the box in Z direction (default: 24 inches / 2 feet)",
                        "default": 24,
                    },
                    "color": {
                        "type": "string",
                        "description": "Color of the box as hex string (e.g., '#ff0000' for red)",
                        "default": "#4a90d9",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_rectangle",
            "description": "Create a 2D rectangle on the ground plane (XZ plane at Y=0). Use this for flat floor plans or 2D shapes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {
                        "type": "number",
                        "description": "X position of rectangle center",
                        "default": 0,
                    },
                    "z": {
                        "type": "number",
                        "description": "Z position of rectangle center",
                        "default": 0,
                    },
                    "width": {
                        "type": "number",
                        "description": "Width in X direction (inches)",
                        "default": 48,
                    },
                    "depth": {
                        "type": "number",
                        "description": "Depth in Z direction (inches)",
                        "default": 48,
                    },
                    "color": {
                        "type": "string",
                        "description": "Color as hex string",
                        "default": "#4a90d9",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clear_scene",
            "description": "Clear all geometry from the scene. Use when user asks to clear, reset, or start fresh.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "api_list_endpoints",
            "description": "List all available API endpoints with their methods and descriptions",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "api_health_check",
            "description": "Check if the FastAPI backend is healthy and responding",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "db_list_tables",
            "description": "List all tables in the database",
            "parameters": {
                "type": "object",
                "properties": {
                    "schema": {
                        "type": "string",
                        "description": "Database schema name (default: public)",
                        "default": "public",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "db_describe_table",
            "description": "Get detailed information about a table including columns and types",
            "parameters": {
                "type": "object",
                "properties": {
                    "table_name": {
                        "type": "string",
                        "description": "Name of the table",
                    },
                    "schema": {
                        "type": "string",
                        "description": "Database schema name (default: public)",
                        "default": "public",
                    },
                },
                "required": ["table_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "db_execute_query",
            "description": "Execute a read-only SQL SELECT query",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "SQL SELECT query",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "db_get_schema",
            "description": "Get a complete schema overview showing all tables and their relationships",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
]


class ChatService:
    """Service for handling chat with OpenAI and tool integration."""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.api_url = "http://localhost:8000"  # Internal API URL
        self.model = "gpt-4o-mini"

    async def _execute_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict:
        """Execute a tool and return the result."""
        try:
            # Scene manipulation tools - return actions for frontend to execute
            if tool_name == "create_box":
                return {
                    "action": "create_box",
                    "params": {
                        "x": arguments.get("x", 0),
                        "y": arguments.get("y", 0),
                        "z": arguments.get("z", 0),
                        "width": arguments.get("width", 24),
                        "height": arguments.get("height", 24),
                        "depth": arguments.get("depth", 24),
                        "color": arguments.get("color", "#4a90d9"),
                    },
                    "success": True,
                    "message": "Box created",
                }
            elif tool_name == "create_rectangle":
                return {
                    "action": "create_rectangle",
                    "params": {
                        "x": arguments.get("x", 0),
                        "z": arguments.get("z", 0),
                        "width": arguments.get("width", 48),
                        "depth": arguments.get("depth", 48),
                        "color": arguments.get("color", "#4a90d9"),
                    },
                    "success": True,
                    "message": "Rectangle created",
                }
            elif tool_name == "clear_scene":
                return {
                    "action": "clear_scene",
                    "params": {},
                    "success": True,
                    "message": "Scene cleared",
                }
            # Database/API tools
            elif tool_name == "api_list_endpoints":
                return await self._api_list_endpoints()
            elif tool_name == "api_health_check":
                return await self._api_health_check()
            elif tool_name == "db_list_tables":
                return await self._db_list_tables(arguments.get("schema", "public"))
            elif tool_name == "db_describe_table":
                return await self._db_describe_table(
                    arguments["table_name"],
                    arguments.get("schema", "public")
                )
            elif tool_name == "db_execute_query":
                return await self._db_execute_query(arguments["query"])
            elif tool_name == "db_get_schema":
                return await self._db_get_schema()
            else:
                return {"error": f"Unknown tool: {tool_name}"}
        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            return {"error": str(e)}

    async def _api_list_endpoints(self) -> dict:
        """List all API endpoints."""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.api_url}/openapi.json")
            schema = response.json()

        endpoints = []
        for path, methods in schema.get("paths", {}).items():
            for method, details in methods.items():
                if method in ["get", "post", "put", "patch", "delete"]:
                    endpoints.append({
                        "path": path,
                        "method": method.upper(),
                        "summary": details.get("summary", ""),
                    })
        return {"endpoints": endpoints}

    async def _api_health_check(self) -> dict:
        """Check API health."""
        start = time.time()
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.api_url}/health")
            elapsed = time.time() - start
            return {
                "status": "healthy" if response.status_code == 200 else "unhealthy",
                "response_time_ms": round(elapsed * 1000, 2),
            }

    async def _db_list_tables(self, schema: str = "public") -> dict:
        """List database tables."""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = $1 AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """,
                schema,
            )
            return {"tables": [row["table_name"] for row in rows]}

    async def _db_describe_table(self, table_name: str, schema: str = "public") -> dict:
        """Describe a database table."""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            columns = await conn.fetch(
                """
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2
                ORDER BY ordinal_position
                """,
                schema,
                table_name,
            )
            return {
                "table_name": table_name,
                "columns": [dict(c) for c in columns],
            }

    async def _db_execute_query(self, query: str) -> dict:
        """Execute a read-only SQL query."""
        query_upper = query.strip().upper()
        if not query_upper.startswith("SELECT") and not query_upper.startswith("WITH"):
            return {"error": "Only SELECT queries are allowed"}

        pool = await get_db_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)
            return {
                "row_count": len(rows),
                "data": [dict(row) for row in rows[:50]],
                "truncated": len(rows) > 50,
            }

    async def _db_get_schema(self) -> dict:
        """Get complete database schema."""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            tables = await conn.fetch(
                """
                SELECT
                    t.table_name,
                    array_agg(c.column_name || ' ' || c.data_type ORDER BY c.ordinal_position) as columns
                FROM information_schema.tables t
                JOIN information_schema.columns c
                    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
                WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
                GROUP BY t.table_name
                ORDER BY t.table_name
                """
            )
            return {"tables": {t["table_name"]: t["columns"] for t in tables}}

    async def chat(
        self,
        message: str,
        conversation_history: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        """
        Process a chat message with OpenAI, handling function calls to MCP tools.

        Args:
            message: The user's message
            conversation_history: Previous messages in the conversation

        Returns:
            Response containing the assistant's reply and any tool calls made
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an AI assistant for a 3D CAD application called Poche. "
                    "You can CREATE 3D geometry in the scene! When users ask you to create, draw, or make shapes "
                    "(boxes, cubes, rectangles, etc.), use the create_box or create_rectangle tools. "
                    "Dimensions are in inches. A typical room might be 120x120 inches (10x10 feet). "
                    "When asked to create a 'red box', use color '#ff0000'. "
                    "You can also query the database, check API endpoints, and clear the scene. "
                    "Be concise in your responses."
                ),
            }
        ]

        if conversation_history:
            messages.extend(conversation_history)

        messages.append({"role": "user", "content": message})

        tool_calls_made = []
        max_iterations = 5  # Prevent infinite loops

        for _ in range(max_iterations):
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )

            assistant_message = response.choices[0].message

            # If no tool calls, we're done
            if not assistant_message.tool_calls:
                return {
                    "response": assistant_message.content,
                    "tool_calls": tool_calls_made,
                }

            # Add assistant message to history
            messages.append(assistant_message.model_dump())

            # Process each tool call
            for tool_call in assistant_message.tool_calls:
                function_name = tool_call.function.name
                try:
                    arguments = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    arguments = {}

                logger.info(f"Calling tool: {function_name} with args: {arguments}")

                # Execute the tool directly
                result = await self._execute_tool(function_name, arguments)

                tool_calls_made.append({
                    "tool": function_name,
                    "arguments": arguments,
                    "result": result,
                })

                # Add tool result to messages
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result),
                })

        # If we hit max iterations, return what we have
        return {
            "response": "I've made several tool calls. Here's what I found.",
            "tool_calls": tool_calls_made,
        }
