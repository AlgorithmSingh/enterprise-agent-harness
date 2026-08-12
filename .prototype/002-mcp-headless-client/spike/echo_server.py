"""Minimal in-process MCP server used as the round-trip target (stdio transport).

Prototype instrument for docs/book/mcp-client-mechanics.md. Exposes three tools
chosen to exercise the chapter's stated result contracts:

* ``echo``            -> plain TextContent result
* ``echo_structured`` -> declares an outputSchema, so the result must carry
                         structuredContent alongside content
* ``always_fails``    -> raises, which the SDK must surface as a *successful*
                         JSON-RPC response with ``isError`` true, not as a
                         protocol-level error

Nothing here touches the network. Spawned as a subprocess by roundtrip_test.py;
stdout carries protocol frames only.
"""

from __future__ import annotations

from typing import Any

SERVER_NAME = "echo-spike"
FAILURE_MESSAGE = "intentional tool failure for isError contract check"


def build_server() -> Any:
    """Construct the FastMCP server and register the spike's tools.

    Built inside a function (not at import time) so importing this module has no
    side effects.
    """
    from mcp.server.fastmcp import FastMCP

    server = FastMCP(SERVER_NAME)

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


def main() -> int:
    """CLI entrypoint: serve MCP over stdio until the client closes the pipe."""
    build_server().run(transport="stdio")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
