"""Deterministic in-process round trip against the mcp 2.0.0 (v2) client API.

docs/book/mcp-client-mechanics.md describes v2 only in a single "for reference"
row and flags most of it unverified. This exercises that row against the real
installed package: the ``Client`` entrypoint, an in-memory server target, the
snake_case ``structured_content`` accessor, and v2's ``raise_exceptions``
option, which has no v1 equivalent and changes the isError contract.

No network: the client is handed a server object, not a URL.

Run with the v2 venv:  .venv/bin/python roundtrip_v2.py
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

ECHO_PAYLOAD = "hello from a deterministic script"
FAILURE_MESSAGE = "intentional tool failure for isError contract check"


def build_server() -> Any:
    """Construct a v2 MCPServer with the same tools as the v1 echo server."""
    from mcp.server.mcpserver import MCPServer

    server = MCPServer("echo-spike-v2")

    @server.tool(description="Return the supplied message unchanged.")
    def echo(message: str) -> str:
        return message

    @server.tool(description="Return the message plus its length as structured output.")
    def echo_structured(message: str) -> dict[str, Any]:
        return {"message": message, "length": len(message)}

    @server.tool(description="Always raise, to exercise the isError channel.")
    def always_fails() -> str:
        raise RuntimeError(FAILURE_MESSAGE)

    return server


def _check(checks: list[dict[str, Any]], name: str, passed: bool, detail: Any) -> None:
    """Record one contract check."""
    checks.append({"check": name, "passed": bool(passed), "detail": detail})


async def run_default_client(checks: list[dict[str, Any]]) -> None:
    """Exercise the default v2 client (raise_exceptions defaults to False)."""
    from mcp import Client

    async with Client(build_server()) as client:
        listed = await client.list_tools()
        names = sorted(t.name for t in listed.tools)
        _check(checks, "v2 Client.list_tools() works without explicit initialize()", names == ["always_fails", "echo", "echo_structured"], names)

        result = await client.call_tool("echo", {"message": ECHO_PAYLOAD})
        texts = [getattr(b, "text", None) for b in result.content]
        _check(checks, "v2 echo round-trips the payload", texts == [ECHO_PAYLOAD], texts)

        _check(checks, "v2 result exposes snake_case .structured_content", hasattr(result, "structured_content"), sorted(type(result).model_fields))
        _check(checks, "v2 result does NOT expose camelCase .structuredContent", not hasattr(result, "structuredContent"), None)
        _check(checks, "v2 result exposes .is_error (not .isError)", hasattr(result, "is_error") and not hasattr(result, "isError"), None)

        structured = await client.call_tool("echo_structured", {"message": ECHO_PAYLOAD})
        _check(
            checks,
            "v2 outputSchema tool populates structured_content",
            isinstance(structured.structured_content, dict)
            and structured.structured_content.get("length") == len(ECHO_PAYLOAD),
            structured.structured_content,
        )

        failed = await client.call_tool("always_fails")
        _check(checks, "v2 default: failing tool does NOT raise", True, "no exception")
        _check(checks, "v2 default: failing tool sets is_error true", failed.is_error is True, failed.is_error)


async def run_raising_client(checks: list[dict[str, Any]]) -> None:
    """Exercise v2's raise_exceptions=True, which has no v1 equivalent."""
    from mcp import Client
    from mcp.shared.exceptions import MCPError

    async with Client(build_server(), raise_exceptions=True) as client:
        try:
            await client.call_tool("always_fails")
            _check(checks, "v2 raise_exceptions=True turns a failing tool into an exception", False, "no exception raised")
        except MCPError as exc:
            _check(checks, "v2 raise_exceptions=True turns a failing tool into an exception", True, f"MCPError: {str(exc)[:120]}")
        except RuntimeError as exc:
            _check(checks, "v2 raise_exceptions=True turns a failing tool into an exception", True, f"RuntimeError: {str(exc)[:120]}")


async def run_all() -> dict[str, Any]:
    """Run both v2 client configurations."""
    checks: list[dict[str, Any]] = []
    await run_default_client(checks)
    await run_raising_client(checks)
    return {"checks": checks, "passed": sum(c["passed"] for c in checks), "total": len(checks)}


def main() -> int:
    """CLI entrypoint: run the v2 round trip and print a single JSON report."""
    report = asyncio.run(run_all())
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] == report["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
