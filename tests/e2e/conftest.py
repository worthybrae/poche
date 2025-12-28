"""Pytest configuration for e2e tests."""

import pytest


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Configure browser context with larger viewport."""
    return {
        **browser_context_args,
        "viewport": {"width": 1280, "height": 800},
    }


@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args):
    """Configure browser launch with headless mode."""
    return {
        **browser_type_launch_args,
        "headless": True,
    }
