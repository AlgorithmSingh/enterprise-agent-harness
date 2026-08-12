"""Deterministic (no-LLM) end-to-end MCP round trip over the stdio transport.

Spawns echo_server.py as a subprocess, runs the full legacy-era handshake, then
asserts the exact result contracts docs/book/mcp-client-mechanics.md states:

1. ``initialize()`` is explicit and must precede everything else.
2. ``list_tools()`` returns typed ``Tool`` objects; a missing ``nextCursor``
   means end-of-results.
3. A normal ``call_tool`` yields ``CallToolResult`` with ``TextContent``.
4. An outputSchema tool populates ``structuredContent``.
5. A tool that raises returns ``isError`` true and does NOT raise client-side.
6. An unknown tool name is a *protocol* error and DOES raise ``McpError``.

The client code path is deliberately written the way the book's Python recipe
writes it, so any drift between book and SDK shows up as a failure here.
Zero network access: the only I/O is a pipe to a local subprocess.

Run with the v1 venv:  .venv-v1/bin/python roundtrip_test.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import timedelta
from pathlib import Path
from typing import Any

from mcp import ClientSession, McpError, StdioServerParameters, types
from mcp.client.stdio import stdio_client

SERVER_SCRIPT = "echo_server.py"
ECHO_PAYLOAD = "hello from a deterministic script"
CALL_TIMEOUT = timedelta(seconds=30)


def _text_blocks(result: types.CallToolResult) -> list[str]:
    """Extract the text of every TextContent block in a tool result."""
    return [b.text for b in result.content if isinstance(b, types.TextContent)]


def _check(checks: list[dict[str, Any]], name: str, passed: bool, detail: Any) -> None:
    """Record one contract check."""
    checks.append({"check": name, "passed": bool(passed), "detail": detail})


async def run_roundtrip(server_script: Path) -> dict[str, Any]:
    """Drive the echo server over stdio and verify every claimed contract."""
    checks: list[dict[str, Any]] = []
    params = StdioServerParameters(
        command=sys.executable, args=[str(server_script)]
    )

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write, read_timeout_seconds=CALL_TIMEOUT) as session:
            init: types.InitializeResult = await session.initialize()
            _check(
                checks,
                "initialize() returns InitializeResult",
                isinstance(init, types.InitializeResult),
                {
                    "protocolVersion": init.protocolVersion,
                    "serverInfo": f"{init.serverInfo.name} {init.serverInfo.version}",
                },
            )

            listed = await session.list_tools()
            names = sorted(t.name for t in listed.tools)
            _check(checks, "list_tools() returns the 3 registered tools", names == ["always_fails", "echo", "echo_structured"], names)
            _check(checks, "no nextCursor => end of results", listed.nextCursor is None, listed.nextCursor)
            _check(
                checks,
                "Tool carries inputSchema",
                all(isinstance(t.inputSchema, dict) for t in listed.tools),
                {t.name: sorted((t.inputSchema or {}).get("properties", {})) for t in listed.tools},
            )

            echoed = await session.call_tool("echo", arguments={"message": ECHO_PAYLOAD})
            _check(checks, "call_tool returns CallToolResult", isinstance(echoed, types.CallToolResult), type(echoed).__name__)
            _check(checks, "echo round-tripped the payload verbatim", _text_blocks(echoed) == [ECHO_PAYLOAD], _text_blocks(echoed))
            _check(checks, "successful call has isError falsy", not echoed.isError, echoed.isError)

            structured = await session.call_tool("echo_structured", arguments={"message": ECHO_PAYLOAD})
            _check(
                checks,
                "outputSchema tool populates structuredContent",
                isinstance(structured.structuredContent, dict)
                and structured.structuredContent.get("length") == len(ECHO_PAYLOAD),
                structured.structuredContent,
            )

            # Contract: a tool that raises is a *successful* JSON-RPC response
            # carrying isError=true. The SDK must not raise here.
            raised_for_tool_failure = False
            failed: types.CallToolResult | None = None
            try:
                failed = await session.call_tool("always_fails")
            except McpError as exc:
                raised_for_tool_failure = True
                _check(checks, "tool failure did NOT raise McpError", False, str(exc))
            if not raised_for_tool_failure and failed is not None:
                _check(checks, "tool failure did NOT raise McpError", True, "no exception")
                _check(checks, "tool failure sets isError true", failed.isError is True, failed.isError)
                _check(
                    checks,
                    "failure message travels in content[].text",
                    any("intentional tool failure" in t for t in _text_blocks(failed)),
                    _text_blocks(failed),
                )

            # Contract: an unknown tool name is a protocol error, not isError.
            unknown_raised: dict[str, Any] | None = None
            try:
                bogus = await session.call_tool("no_such_tool_exists")
                unknown_raised = {"raised": False, "isError": bogus.isError, "content": _text_blocks(bogus)}
            except McpError as exc:
                unknown_raised = {"raised": True, "code": exc.error.code, "message": exc.error.message}
            # This check is EXPECTED TO FAIL against the Python reference
            # server; the failure is the finding. See README.md, contradiction 1.
            _check(
                checks,
                "BOOK CLAIM: unknown tool name surfaces as a protocol error (McpError)",
                bool(unknown_raised.get("raised")),
                unknown_raised,
            )

    return {"checks": checks, "passed": sum(c["passed"] for c in checks), "total": len(checks)}


def main() -> int:
    """CLI entrypoint: run the round trip and print a single JSON report."""
    report = asyncio.run(run_roundtrip(Path(__file__).resolve().parent / SERVER_SCRIPT))
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] == report["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
