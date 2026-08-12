<!-- Source: https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/1.30.0/src/{types.ts,shared/protocol.ts,client/streamableHttp.ts,client/stdio.ts,client/index.ts} -->
<!-- Accessed: 2026-08-12 -->
<!-- Verbatim excerpts of load-bearing constants and signatures from @modelcontextprotocol/sdk 1.30.0 (npm dist-tag `latest` on 2026-08-12 per https://registry.npmjs.org/@modelcontextprotocol/sdk). Full raw files cached alongside as raw-ts-sdk-1.30.0-*.ts -->

# @modelcontextprotocol/sdk 1.30.0 — verified constants

## src/types.ts

```typescript
export const LATEST_PROTOCOL_VERSION = '2025-11-25';
export const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = '2025-03-26';
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07'];

export enum ErrorCode {
    // SDK error codes
    ConnectionClosed = -32000,
    RequestTimeout = -32001,

    // Standard JSON-RPC error codes
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,

    // MCP-specific error codes
    UrlElicitationRequired = -32042
}
```

`McpError extends Error` with `code`, `message`, `data` (types.ts line 2307).

## src/shared/protocol.ts

```typescript
export const DEFAULT_REQUEST_TIMEOUT_MSEC = 60000;

export type RequestOptions = {
    onprogress?: ProgressCallback;
    signal?: AbortSignal;
    timeout?: number;                  // per-request; default DEFAULT_REQUEST_TIMEOUT_MSEC; raises McpError(RequestTimeout)
    resetTimeoutOnProgress?: boolean;  // default false
    maxTotalTimeout?: number;          // no default cap
    task?: TaskCreationParams;
    relatedTask?: RelatedTaskMetadata;
} & TransportSendOptions;
```

`Protocol.close(): Promise<void>` at line 942.

## src/client/streamableHttp.ts

```typescript
const DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS: StreamableHTTPReconnectionOptions = {
    initialReconnectionDelay: 1000,
    maxReconnectionDelay: 30000,
    reconnectionDelayGrowFactor: 1.5,
    maxRetries: 2
};
```

- Options: `authProvider?: OAuthClientProvider`, `requestInit?: RequestInit`, `fetch?: FetchLike`, `reconnectionOptions?`, `sessionId?`.
- Session id is echoed as request header `mcp-session-id` once assigned.
- Server SSE `retry:` field overrides the exponential backoff (`_getNextReconnectionDelay`).
- Reconnection is only scheduled for SSE streams and only when the JSON-RPC response has not yet been received (`receivedResponse` guard in `_handleSseStream`); after `maxRetries` the transport calls `onerror`. There is NO handling of HTTP 429 or `Retry-After` anywhere in the file (grep for `429`/`Retry-After` returns nothing), and failed POSTs are not re-sent.
- 401 handling: with `authProvider`, `auth()` is re-run and the request retried once authorized; without one, `UnauthorizedError` is thrown ("No auth provider").
- `terminateSession()` sends HTTP DELETE with the `Mcp-Session-Id` header (line ~615-635).

## src/client/stdio.ts

- `StdioServerParameters`: `command`, `args?`, `env?` (defaults to `getDefaultEnvironment()` filtered through `DEFAULT_INHERITED_ENV_VARS` — the child does NOT inherit the full parent env), `cwd?`, `stderr?` (default `"inherit"`).

## src/client/index.ts

- `Client.connect(transport, options?: RequestOptions)`: sends `initialize` with `LATEST_PROTOCOL_VERSION`, rejects servers whose reply `protocolVersion` is not in `SUPPORTED_PROTOCOL_VERSIONS`, then calls `transport.setProtocolVersion(result.protocolVersion)` and emits `notifications/initialized`. On any initialize failure, `close()` is called.
- `callTool(params, resultSchema = CallToolResultSchema, options?)`: issues `tools/call`; validates `structuredContent` against a cached `outputSchema` validator (populated by `listTools()`); throws `McpError(ErrorCode.InvalidRequest)` if the tool declared an `outputSchema` but returned neither `structuredContent` nor `isError`. It does NOT throw when `result.isError` is true — the caller must check.
- `listTools(params?, options?)`: issues `tools/list`, caches tool output validators.

## package.json

`"name": "@modelcontextprotocol/sdk", "version": "1.30.0"`. Example client imports (src/examples/client/simpleStreamableHttp.ts) resolve to the published subpaths `@modelcontextprotocol/sdk/client/index.js`, `@modelcontextprotocol/sdk/client/streamableHttp.js`, `@modelcontextprotocol/sdk/types.js`; docs/client.md additionally shows `@modelcontextprotocol/sdk/client/stdio.js`.
