"""Playwright integration tools for the MCP server."""

import base64
import os
from datetime import datetime

from playwright.async_api import async_playwright, Browser, Page
from fastmcp import FastMCP

from ..config import settings

# Global browser and page management
_browser: Browser | None = None
_pages: dict[str, Page] = {}

SCREENSHOT_DIR = os.getenv("SCREENSHOT_DIR", "/tmp/screenshots")


async def get_browser() -> Browser:
    """Get or create browser instance."""
    global _browser
    if _browser is None:
        playwright = await async_playwright().start()
        _browser = await playwright.chromium.launch(
            headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
    return _browser


def register_playwright_tools(mcp: FastMCP) -> None:
    """Register all Playwright tools with the MCP server."""

    @mcp.tool
    async def browser_navigate(url: str | None = None, page_id: str = "default") -> dict:
        """
        Navigate to a URL in the browser. Creates a new page if needed.

        Args:
            url: Full URL or path (e.g., "/dashboard"). If path, prepends frontend URL.
            page_id: Identifier for this page session (default: "default")

        Returns:
            Page information including title and current URL
        """
        browser = await get_browser()

        if page_id not in _pages:
            _pages[page_id] = await browser.new_page()

        page = _pages[page_id]

        # Handle relative paths
        if url:
            if url.startswith("/"):
                url = f"{settings.frontend_url}{url}"
            elif not url.startswith("http"):
                url = f"{settings.frontend_url}/{url}"
        else:
            url = settings.frontend_url

        await page.goto(url, wait_until="networkidle")

        return {
            "page_id": page_id,
            "url": page.url,
            "title": await page.title(),
        }

    @mcp.tool
    async def browser_screenshot(
        page_id: str = "default",
        full_page: bool = False,
        selector: str | None = None,
        filename: str | None = None,
    ) -> dict:
        """
        Take a screenshot of the current page or a specific element.

        Args:
            page_id: Page session identifier
            full_page: Capture entire scrollable page
            selector: CSS selector to screenshot specific element
            filename: Custom filename (auto-generated if not provided)

        Returns:
            Screenshot path and base64-encoded image data
        """
        if page_id not in _pages:
            return {"error": f"No page found with id '{page_id}'. Call browser_navigate first."}

        page = _pages[page_id]

        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"screenshot_{page_id}_{timestamp}.png"

        os.makedirs(SCREENSHOT_DIR, exist_ok=True)
        filepath = os.path.join(SCREENSHOT_DIR, filename)

        if selector:
            element = await page.query_selector(selector)
            if element:
                await element.screenshot(path=filepath)
            else:
                return {"error": f"Element not found: {selector}"}
        else:
            await page.screenshot(path=filepath, full_page=full_page)

        # Read and encode
        with open(filepath, "rb") as f:
            image_data = base64.b64encode(f.read()).decode()

        return {
            "filepath": filepath,
            "filename": filename,
            "base64_preview": image_data[:100] + "...",
            "full_base64_length": len(image_data),
        }

    @mcp.tool
    async def browser_click(selector: str, page_id: str = "default") -> dict:
        """
        Click an element on the page.

        Args:
            selector: CSS selector for the element
            page_id: Page session identifier

        Returns:
            Success status and current URL after click
        """
        if page_id not in _pages:
            return {"error": f"No page found with id '{page_id}'"}

        page = _pages[page_id]

        try:
            await page.click(selector, timeout=5000)
            await page.wait_for_load_state("networkidle")
            return {"success": True, "selector": selector, "url": page.url}
        except Exception as e:
            return {"error": str(e), "selector": selector}

    @mcp.tool
    async def browser_fill(selector: str, value: str, page_id: str = "default") -> dict:
        """
        Fill a form input with text.

        Args:
            selector: CSS selector for the input element
            value: Text to enter
            page_id: Page session identifier

        Returns:
            Success status
        """
        if page_id not in _pages:
            return {"error": f"No page found with id '{page_id}'"}

        page = _pages[page_id]

        try:
            await page.fill(selector, value, timeout=5000)
            return {"success": True, "selector": selector, "value": value}
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool
    async def browser_get_content(page_id: str = "default") -> dict:
        """
        Get the current page's text content and interactive elements.

        Args:
            page_id: Page session identifier

        Returns:
            Page title, URL, visible text, buttons, links, and inputs
        """
        if page_id not in _pages:
            return {"error": f"No page found with id '{page_id}'"}

        page = _pages[page_id]

        # Extract visible text
        text_content = await page.evaluate("() => document.body.innerText")

        # Find interactive elements
        buttons = await page.evaluate(
            """
            () => Array.from(document.querySelectorAll('button, [role="button"]'))
                .map(el => ({text: el.innerText, class: el.className}))
                .slice(0, 20)
            """
        )

        links = await page.evaluate(
            """
            () => Array.from(document.querySelectorAll('a[href]'))
                .map(el => ({text: el.innerText, href: el.href}))
                .slice(0, 20)
            """
        )

        inputs = await page.evaluate(
            """
            () => Array.from(document.querySelectorAll('input, textarea, select'))
                .map(el => ({type: el.type, name: el.name, id: el.id, placeholder: el.placeholder}))
                .slice(0, 20)
            """
        )

        return {
            "url": page.url,
            "title": await page.title(),
            "text_content": text_content[:5000],
            "buttons": buttons,
            "links": links,
            "inputs": inputs,
        }

    @mcp.tool
    async def browser_visual_test(
        test_name: str,
        url: str,
        assertions: list[dict],
        page_id: str = "default",
    ) -> dict:
        """
        Run a visual test with assertions.

        Args:
            test_name: Name for this test
            url: URL to test (relative or absolute)
            assertions: List of assertions, each with:
                - type: 'element_exists', 'text_contains', 'element_count'
                - selector: CSS selector
                - value: Expected value (for text_contains and element_count)
            page_id: Page session identifier

        Returns:
            Test results with pass/fail for each assertion
        """
        # Navigate to URL
        await browser_navigate(url, page_id)
        page = _pages[page_id]

        results = []
        all_passed = True

        for assertion in assertions:
            assertion_type = assertion.get("type")
            selector = assertion.get("selector")
            expected = assertion.get("value")

            result = {"type": assertion_type, "selector": selector, "passed": False}

            try:
                if assertion_type == "element_exists":
                    element = await page.query_selector(selector)
                    result["passed"] = element is not None
                    result["details"] = (
                        "Element found" if element else "Element not found"
                    )

                elif assertion_type == "text_contains":
                    text = await page.inner_text(selector)
                    result["passed"] = expected in text
                    result["details"] = (
                        f"Found: '{text[:100]}...'"
                        if len(text) > 100
                        else f"Found: '{text}'"
                    )

                elif assertion_type == "element_count":
                    elements = await page.query_selector_all(selector)
                    actual_count = len(elements)
                    result["passed"] = actual_count == expected
                    result["details"] = f"Expected {expected}, found {actual_count}"

            except Exception as e:
                result["error"] = str(e)

            if not result["passed"]:
                all_passed = False
            results.append(result)

        # Take screenshot for reference
        screenshot_result = await browser_screenshot(
            page_id, filename=f"test_{test_name}.png"
        )

        return {
            "test_name": test_name,
            "url": url,
            "passed": all_passed,
            "assertions": results,
            "screenshot": screenshot_result.get("filepath"),
        }

    @mcp.tool
    async def browser_generate_test(
        actions: list[dict], test_name: str = "generated_test"
    ) -> str:
        """
        Generate Playwright test code from a sequence of actions.

        Args:
            actions: List of actions performed, each with:
                - action: 'navigate', 'click', 'fill', 'screenshot', 'assert_visible', 'assert_text'
                - params: Action parameters
            test_name: Name for the generated test

        Returns:
            Python Playwright test code
        """
        code_lines = [
            "import pytest",
            "from playwright.sync_api import Page, expect",
            "",
            f"def test_{test_name}(page: Page):",
        ]

        for action in actions:
            action_type = action.get("action")
            params = action.get("params", {})

            if action_type == "navigate":
                url = params.get("url", "/")
                code_lines.append(f'    page.goto("{url}")')

            elif action_type == "click":
                selector = params.get("selector")
                code_lines.append(f'    page.click("{selector}")')

            elif action_type == "fill":
                selector = params.get("selector")
                value = params.get("value")
                code_lines.append(f'    page.fill("{selector}", "{value}")')

            elif action_type == "screenshot":
                filename = params.get("filename", "screenshot.png")
                code_lines.append(f'    page.screenshot(path="{filename}")')

            elif action_type == "assert_visible":
                selector = params.get("selector")
                code_lines.append(
                    f'    expect(page.locator("{selector}")).to_be_visible()'
                )

            elif action_type == "assert_text":
                selector = params.get("selector")
                text = params.get("text")
                code_lines.append(
                    f'    expect(page.locator("{selector}")).to_contain_text("{text}")'
                )

        return "\n".join(code_lines)

    @mcp.tool
    async def browser_close_page(page_id: str = "default") -> dict:
        """
        Close a browser page session.

        Args:
            page_id: Page session identifier

        Returns:
            Success status
        """
        if page_id in _pages:
            await _pages[page_id].close()
            del _pages[page_id]
            return {"success": True, "page_id": page_id}
        return {"error": f"No page found with id '{page_id}'"}

    @mcp.tool
    async def browser_cleanup() -> dict:
        """
        Close all pages and browser. Call this when done with browser testing.

        Returns:
            Success status
        """
        global _browser, _pages

        for page_id in list(_pages.keys()):
            await _pages[page_id].close()
        _pages.clear()

        if _browser:
            await _browser.close()
            _browser = None

        return {"success": True, "message": "All browser resources cleaned up"}
