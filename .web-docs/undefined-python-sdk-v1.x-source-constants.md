<!-- Source: https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/v1.x/src/mcp/{client/streamable_http.py,client/session.py,shared/_httpx_utils.py} -->
<!-- Accessed: 2026-08-12 -->
<!-- Verbatim excerpts of load-bearing constants and signatures from the mcp Python SDK v1.x maintenance branch (latest 1.x release on PyPI: 1.29.0; `pip install mcp` now installs 2.0.0 — pin `mcp>=1.28,<2` to stay on v1). Full raw files cached alongside as raw-python-sdk-v1.x-*.py -->

# mcp Python SDK v1.x — verified constants

## src/mcp/shared/_httpx_utils.py

```python
MCP_DEFAULT_TIMEOUT = 30.0  # General operations (seconds)
MCP_DEFAULT_SSE_READ_TIMEOUT = 300.0  # SSE streams - 5 minutes (seconds)
```

`create_mcp_http_client(headers=None, timeout=None, auth=None)` builds an `httpx.AsyncClient` with `httpx.Timeout(MCP_DEFAULT_TIMEOUT, read=MCP_DEFAULT_SSE_READ_TIMEOUT)` when no timeout is given.

## src/mcp/client/streamable_http.py

```python
async def streamable_http_client(
    url: str,
    *,
    http_client: httpx.AsyncClient | None = None,
    terminate_on_close: bool = True,
) -> AsyncGenerator[tuple[read_stream, write_stream, GetSessionIdCallback], None]:
```

- To set headers/auth/timeouts, pass a pre-configured `httpx.AsyncClient` as `http_client`.
- `terminate_on_close=True` sends an HTTP DELETE to terminate the session on context exit.
- `streamablehttp_client` still exists but is decorated `@deprecated("Use `streamable_http_client` instead.")`; its legacy parameters `headers`, `timeout` (default 30), `sse_read_timeout` (default 300), `auth` are deprecated and ignored with a runtime warning.

## src/mcp/client/session.py

```python
class ClientSession(...):
    def __init__(self, read_stream, write_stream,
                 read_timeout_seconds: timedelta | None = None, ...)

    async def initialize(self) -> types.InitializeResult: ...

    async def call_tool(
        self,
        name: str,
        arguments: dict[str, Any] | None = None,
        read_timeout_seconds: timedelta | None = None,
        progress_callback: ProgressFnT | None = None,
        *,
        meta: dict[str, Any] | None = None,
    ) -> types.CallToolResult: ...

    async def list_tools(...) -> types.ListToolsResult  # overloads: (), (cursor), (params=PaginatedRequestParams)
```

`call_tool` sends `tools/call` with `request_read_timeout_seconds=read_timeout_seconds`; it returns the `CallToolResult` and does not raise on `isError` (it only runs output-schema validation `if not result.isError`).
