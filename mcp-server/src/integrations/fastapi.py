"""FastAPI integration tools for the MCP server."""

import httpx
from fastmcp import FastMCP

from ..config import settings


def register_fastapi_tools(mcp: FastMCP) -> None:
    """Register all FastAPI tools with the MCP server."""

    @mcp.tool
    async def api_get_schema() -> dict:
        """
        Retrieve the OpenAPI schema from the FastAPI backend.

        Returns:
            Complete OpenAPI schema including endpoints, request/response schemas
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{settings.fastapi_url}/openapi.json")
            return response.json()

    @mcp.tool
    async def api_list_endpoints() -> list[dict]:
        """
        List all available API endpoints with their methods and descriptions.

        Returns:
            List of endpoints with path, method, summary, and tags
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{settings.fastapi_url}/openapi.json")
            schema = response.json()

        endpoints = []
        for path, methods in schema.get("paths", {}).items():
            for method, details in methods.items():
                if method in ["get", "post", "put", "patch", "delete"]:
                    endpoints.append(
                        {
                            "path": path,
                            "method": method.upper(),
                            "summary": details.get("summary", ""),
                            "description": details.get("description", ""),
                            "tags": details.get("tags", []),
                        }
                    )
        return endpoints

    @mcp.tool
    async def api_call(
        method: str,
        path: str,
        body: dict | None = None,
        query_params: dict | None = None,
    ) -> dict:
        """
        Make an HTTP request to the FastAPI backend.

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE)
            path: API path (e.g., /api/v1/items)
            body: Request body for POST/PUT/PATCH requests
            query_params: Query parameters

        Returns:
            Response data including status code, headers, and body
        """
        async with httpx.AsyncClient(base_url=settings.fastapi_url) as client:
            response = await client.request(
                method=method.upper(),
                url=path,
                json=body,
                params=query_params,
            )

            try:
                response_body = response.json()
            except Exception:
                response_body = response.text

            return {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response_body,
            }

    @mcp.tool
    async def api_test(
        test_name: str,
        method: str,
        path: str,
        expected_status: int,
        body: dict | None = None,
        expected_fields: list[str] | None = None,
    ) -> dict:
        """
        Run a simple API test and validate the response.

        Args:
            test_name: Name for this test
            method: HTTP method
            path: API path
            expected_status: Expected HTTP status code
            body: Request body if needed
            expected_fields: Fields expected in response body

        Returns:
            Test result with pass/fail status and details
        """
        result = await api_call(method, path, body)

        passed = True
        failures = []

        # Check status code
        if result["status_code"] != expected_status:
            passed = False
            failures.append(
                f"Expected status {expected_status}, got {result['status_code']}"
            )

        # Check expected fields
        if expected_fields and isinstance(result["body"], dict):
            for field in expected_fields:
                if field not in result["body"]:
                    passed = False
                    failures.append(f"Missing expected field: {field}")

        return {
            "test_name": test_name,
            "passed": passed,
            "failures": failures,
            "response": result,
        }

    @mcp.tool
    async def api_health_check() -> dict:
        """
        Check if the FastAPI backend is healthy and responding.

        Returns:
            Health status including response time
        """
        import time

        start = time.time()
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{settings.fastapi_url}/health")
                elapsed = time.time() - start
                return {
                    "status": "healthy",
                    "status_code": response.status_code,
                    "response_time_ms": round(elapsed * 1000, 2),
                    "response": (
                        response.json() if response.status_code == 200 else None
                    ),
                }
            except Exception as e:
                return {
                    "status": "unhealthy",
                    "error": str(e),
                }
