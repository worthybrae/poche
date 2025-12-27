"""PostgreSQL integration tools for the MCP server."""

import asyncpg
from fastmcp import FastMCP

from ..config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """Get or create database connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.database_url)
    return _pool


def register_postgres_tools(mcp: FastMCP) -> None:
    """Register all PostgreSQL tools with the MCP server."""

    @mcp.tool
    async def db_list_tables(schema: str = "public") -> list[dict]:
        """
        List all tables in the specified database schema.

        Args:
            schema: Database schema name (default: public)

        Returns:
            List of tables with their names and sizes
        """
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    table_name,
                    pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
                FROM information_schema.tables
                WHERE table_schema = $1 AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """,
                schema,
            )
            return [dict(row) for row in rows]

    @mcp.tool
    async def db_describe_table(table_name: str, schema: str = "public") -> dict:
        """
        Get detailed information about a table including columns, constraints, and indexes.

        Args:
            table_name: Name of the table
            schema: Database schema name (default: public)

        Returns:
            Table details including columns, primary key, foreign keys, and indexes
        """
        pool = await get_pool()
        async with pool.acquire() as conn:
            # Get columns
            columns = await conn.fetch(
                """
                SELECT
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2
                ORDER BY ordinal_position
                """,
                schema,
                table_name,
            )

            # Get primary key
            pk = await conn.fetch(
                """
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = ($1 || '.' || $2)::regclass AND i.indisprimary
                """,
                schema,
                table_name,
            )

            # Get foreign keys
            fks = await conn.fetch(
                """
                SELECT
                    kcu.column_name,
                    ccu.table_name AS foreign_table,
                    ccu.column_name AS foreign_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = $1 AND tc.table_name = $2
                """,
                schema,
                table_name,
            )

            # Get indexes
            indexes = await conn.fetch(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = $1 AND tablename = $2
                """,
                schema,
                table_name,
            )

            return {
                "table_name": table_name,
                "schema": schema,
                "columns": [dict(c) for c in columns],
                "primary_key": [r["attname"] for r in pk],
                "foreign_keys": [dict(fk) for fk in fks],
                "indexes": [dict(i) for i in indexes],
            }

    @mcp.tool
    async def db_execute_query(query: str, params: list | None = None) -> dict:
        """
        Execute a read-only SQL query. Only SELECT statements are allowed.

        Args:
            query: SQL SELECT query
            params: Optional query parameters

        Returns:
            Query results as list of dictionaries
        """
        # Safety check - only allow SELECT
        query_upper = query.strip().upper()
        if not query_upper.startswith("SELECT") and not query_upper.startswith("WITH"):
            return {"error": "Only SELECT queries are allowed for safety"}

        pool = await get_pool()
        async with pool.acquire() as conn:
            try:
                if params:
                    rows = await conn.fetch(query, *params)
                else:
                    rows = await conn.fetch(query)

                return {
                    "success": True,
                    "row_count": len(rows),
                    "data": [dict(row) for row in rows[:100]],
                    "truncated": len(rows) > 100,
                }
            except Exception as e:
                return {"error": str(e)}

    @mcp.tool
    async def db_get_schema() -> dict:
        """
        Get a complete schema overview showing all tables and their relationships.

        Returns:
            Schema diagram with tables, columns, and relationships
        """
        pool = await get_pool()
        async with pool.acquire() as conn:
            # Get all tables with their columns
            tables = await conn.fetch(
                """
                SELECT
                    t.table_name,
                    array_agg(
                        c.column_name || ' ' || c.data_type
                        ORDER BY c.ordinal_position
                    ) as columns
                FROM information_schema.tables t
                JOIN information_schema.columns c
                    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
                WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
                GROUP BY t.table_name
                ORDER BY t.table_name
                """
            )

            # Get relationships
            relationships = await conn.fetch(
                """
                SELECT
                    tc.table_name as from_table,
                    kcu.column_name as from_column,
                    ccu.table_name AS to_table,
                    ccu.column_name AS to_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
                """
            )

            return {
                "tables": {t["table_name"]: t["columns"] for t in tables},
                "relationships": [dict(r) for r in relationships],
            }
