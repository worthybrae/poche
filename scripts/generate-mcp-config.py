#!/usr/bin/env python3
"""Generate MCP configuration for Claude Desktop or Claude Code."""

import json
import os
import sys


def generate_claude_config(mcp_url: str = "http://localhost:8080") -> dict:
    """Generate claude_desktop_config.json for MCP servers."""
    return {
        "mcpServers": {
            "app-dev": {
                "type": "sse",
                "url": f"{mcp_url}/sse",
            }
        }
    }


def get_default_config_path() -> str:
    """Get the default config path based on OS."""
    if sys.platform == "win32":
        return os.path.expandvars(r"%APPDATA%\Claude\claude_desktop_config.json")
    elif sys.platform == "darwin":
        return os.path.expanduser(
            "~/Library/Application Support/Claude/claude_desktop_config.json"
        )
    else:
        return os.path.expanduser("~/.config/claude/claude_desktop_config.json")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Generate MCP configuration")
    parser.add_argument(
        "--url",
        default="http://localhost:8080",
        help="MCP server URL (default: http://localhost:8080)",
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output file path (default: print to stdout)",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help="Install to Claude Desktop config location",
    )
    args = parser.parse_args()

    config = generate_claude_config(args.url)

    if args.install:
        config_path = get_default_config_path()
        os.makedirs(os.path.dirname(config_path), exist_ok=True)

        # Merge with existing config if present
        if os.path.exists(config_path):
            with open(config_path) as f:
                existing = json.load(f)
            existing.setdefault("mcpServers", {}).update(config["mcpServers"])
            config = existing

        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)
        print(f"Configuration installed to: {config_path}")

    elif args.output:
        with open(args.output, "w") as f:
            json.dump(config, f, indent=2)
        print(f"Configuration written to: {args.output}")

    else:
        print("MCP Server Configuration:")
        print(json.dumps(config, indent=2))
        print(f"\nTo use with Claude Desktop, save to: {get_default_config_path()}")
        print("\nFor Claude Code, add to your .claude/settings.json or run:")
        print("  python scripts/generate-mcp-config.py --install")


if __name__ == "__main__":
    main()
