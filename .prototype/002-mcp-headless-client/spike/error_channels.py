"""Map which failures use which MCP error channel, against a real local server.

docs/book/mcp-client-mechanics.md claims two channels:
  1. protocol error  -> JSON-RPC error object (cited: -32602 for unknown tool
     name / invalid params), raised client-side as McpError;
  2. tool execution error -> successful response with isError true, never raised.

This probe drives both a FastMCP server (echo_server.py) and a bare low-level
Server with no handlers registered, and records which channel each failure mode
actually takes. No network: subprocess pipes only.

Run with the v1 venv:  .venv-v1/bin/python error_channels.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from mcp import ClientSession, McpError, StdioServerParameters
from mcp.client.stdio import stdio_client

BARE_SERVER_FLAG = "--serve-bare"
BARE_SERVER_NAME = "bare-no-handlers"


async def _serve_bare() -> None:
    """Serve a low-level MCP server that registers no request handlers at all."""
    from mcp.server.lowlevel import Server
    from mcp.server.stdio import stdio_server

    server: Any = Server(BARE_SERVER_NAME)
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


async def _observe(session: ClientSession, label: str, call: Any) -> dict[str, Any]:
    """Run one call and record which error channel it used."""
    try:
        result = await call()
    except McpError as exc:
        return {
            "case": label,
            "channel": "protocol-error (McpError raised)",
            "code": exc.error.code,
            "message": exc.error.message[:160],
        }
    is_error = getattr(result, "isError", None)
    texts = [getattr(block, "text", "") for block in getattr(result, "content", [])]
    return {
        "case": label,
        "channel": "result" if is_error is not True else "isError result (no exception)",
        "isError": is_error,
        "text": (texts[0][:160] if texts else None),
    }


async def probe_fastmcp(server_script: Path) -> list[dict[str, Any]]:
    """Probe failure modes against the FastMCP echo server."""
    params = StdioServerParameters(command=sys.executable, args=[str(server_script)])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            return [
                await _observe(session, "unknown tool name", lambda: session.call_tool("no_such_tool")),
                await _observe(session, "missing required argument", lambda: session.call_tool("echo", arguments={})),
                await _observe(session, "argument of wrong type", lambda: session.call_tool("echo", arguments={"message": {"not": "a string"}})),
                await _observe(session, "unexpected extra argument", lambda: session.call_tool("echo", arguments={"message": "ok", "bogus": 1})),
                await _observe(session, "tool raises at runtime", lambda: session.call_tool("always_fails")),
            ]


async def probe_bare() -> list[dict[str, Any]]:
    """Probe a server with no handlers, where method-not-found is reachable."""
    params = StdioServerParameters(command=sys.executable, args=[str(Path(__file__).resolve()), BARE_SERVER_FLAG])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            return [
                await _observe(session, "tools/list on server with no handlers", lambda: session.list_tools()),
                await _observe(session, "tools/call on server with no handlers", lambda: session.call_tool("anything")),
            ]


async def run_probes() -> dict[str, Any]:
    """Collect the full error-channel map."""
    here = Path(__file__).resolve().parent
    return {
        "fastmcp_server": await probe_fastmcp(here / "echo_server.py"),
        "bare_lowlevel_server": await probe_bare(),
    }


def main() -> int:
    """CLI entrypoint: serve when asked, otherwise probe and print JSON."""
    if BARE_SERVER_FLAG in sys.argv[1:]:
        asyncio.run(_serve_bare())
        return 0
    print(json.dumps(asyncio.run(run_probes()), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
