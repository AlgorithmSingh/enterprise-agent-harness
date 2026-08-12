---
type: reference
title: "Programmatic MCP Client Mechanics (TypeScript and Python)"
description: "Verified mechanics for calling MCP servers deterministically from scripts: spec revisions and transports, @modelcontextprotocol/sdk 1.30.0 and mcp 1.x client APIs with exact timeouts and error shapes, the mcp-remote OAuth bridge, and scheduler/failure-handling rules."
timestamp: "2026-08-12"
---

# Programmatic MCP Client Mechanics (TypeScript and Python)

## Overview

This chapter covers calling MCP servers **deterministically from scripts** — no LLM in the loop. An MCP server is just a JSON-RPC 2.0 peer reachable over stdio or HTTP; a scheduler can drive `tools/list` and `tools/call` like any RPC API.

**Protocol eras — read this first.** As of 2026-08-12 there are two incompatible protocol generations:

| Era | Spec revisions | Session model | Who speaks it |
|---|---|---|---|
| **Legacy** (handshake) | `2024-11-05` … `2025-11-25` | `initialize` request → `initialize` result → `notifications/initialized`; capabilities negotiated once per session; on Streamable HTTP an optional `Mcp-Session-Id` header pins the session | `@modelcontextprotocol/sdk` **1.x** (TS), `mcp` **1.x** (Python), `mcp-remote`, and essentially all deployed servers, including Atlassian's remote MCP |
| **Modern** (stateless) | **`2026-07-28`** (current spec revision) | No handshake at all: every request carries `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` in `_meta`; `Mcp-Session-Id` and the `initialize` method are removed; servers MUST implement `server/discover` | v2 SDKs: `@modelcontextprotocol/client` 2.0.0 (npm), `mcp` 2.0.0 (PyPI) — both also speak every legacy revision |

Sources: spec changelog (SEP-2575/SEP-2567) and versioning page under `modelcontextprotocol.io/specification/2026-07-28/`.

**This chapter targets the deployed (legacy-era) stack**, because that is what the harness will run against:

| Component | Version verified (2026-08-12) | Notes |
|---|---|---|
| `@modelcontextprotocol/sdk` (npm) | 1.30.0 (`latest` dist-tag) | Sends `initialize` with `protocolVersion: "2025-11-25"`; accepts `['2025-11-25','2025-06-18','2025-03-26','2024-11-05','2024-10-07']` |
| `mcp` (PyPI) | 2.0.0 is `latest`; **pin `mcp>=1.29,<2`** — v2 keeps the `ClientSession` import path but changes its semantics incompatibly (`read_timeout_seconds` becomes a bare `float`, `list_tools` loses its positional cursor, `.isError`/`.structuredContent` become `.is_error`/`.structured_content`, `McpError` becomes `MCPError`, `mcp.server.fastmcp` is replaced by `mcp.server.mcpserver.MCPServer`, and v2 depends on `httpx2` not `httpx`), so an unpinned upgrade fails at runtime, not at import (last 1.x release: 1.29.0, maintained on the `v1.x` branch) | Python ≥ 3.10 |
| `mcp-remote` (npm) | 0.1.38 (last publish 2026-02-05) | stdio→remote bridge with OAuth; requires Node ≥ 18 |
| Atlassian Rovo MCP Server | `https://mcp.atlassian.com/v1/mcp/authv2` (Streamable HTTP) | See [atlassian-rovo-mcp.md](atlassian-rovo-mcp.md) for tools and rate limits |

**Transports** (both eras):

- **stdio** — client spawns the server as a subprocess; newline-delimited JSON-RPC (UTF-8, no embedded newlines) on stdin/stdout. The server MUST NOT write anything to stdout that is not a valid MCP message; stderr is free-form logging and SHOULD NOT be treated as an error signal.
- **Streamable HTTP** — a single MCP endpoint URL supporting POST (every client JSON-RPC message is a new POST) and GET (optional server→client SSE stream). The server answers a POSTed *request* with either `Content-Type: application/json` (one JSON object) or `Content-Type: text/event-stream` (SSE stream that eventually carries the response); clients MUST support both. POSTed *notifications/responses* get `202 Accepted` with no body.
- **HTTP+SSE** (two-endpoint, protocol `2024-11-05`) — deprecated since `2025-03-26`, formally Deprecated under the 2026-07-28 feature-lifecycle policy. `mcp-remote` still supports it as a fallback.

## Authentication

MCP's authorization framework (OAuth 2.1) applies to HTTP transports only; the spec says stdio servers SHOULD instead take credentials from the environment.

### TypeScript SDK (1.30.0)

| Mechanism | Exact usage |
|---|---|
| Static headers (API token, bearer) | `new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: 'Bearer …' } } })` — headers are merged into every request |
| OAuth | `authProvider: OAuthClientProvider` option; on 401 the transport runs the auth flow (refresh, then `redirectToAuthorization`) and retries; with no `authProvider`, any auth-required response throws `UnauthorizedError` |
| stdio env | `StdioClientTransport({ command, args, env })` — **the child does not inherit the full parent environment**; default is `getDefaultEnvironment()` filtered by `DEFAULT_INHERITED_ENV_VARS`, so pass required variables in `env` explicitly |

### Python SDK (1.x)

`streamable_http_client(url, http_client=...)` — supply a pre-configured `httpx.AsyncClient` to set headers/auth (the old `headers=`, `auth=` parameters are deprecated and *ignored* with a runtime warning).

### mcp-remote 0.1.38 (headless bridge to OAuth-protected remote servers)

`mcp-remote` presents a stdio MCP server to your script and proxies to a remote URL, doing the OAuth 2.1 browser dance itself:

- **Flow**: on first connect it opens the system browser to the authorization URL and listens for the redirect on a **port derived from the server URL** — `3335 + (first 4 hex digits of md5(url) mod 45816)`, range 3335–49150 — not the README's "3334 default", which is outside the derivation range (verified in mcp-remote 0.1.38 source, `.prototype/002-mcp-headless-client/`). For `https://mcp.atlassian.com/v1/mcp/authv2` the derived callback port is **39570**. An explicit positional port argument after the URL is the only way to pin it; if the chosen port is busy a random open port is used; `--host` changes the callback host. OAuth callback timeout defaults to **30 s** (`--auth-timeout <seconds>`).
- **Token storage**: everything (client registration, tokens) is persisted under the version-scoped **`~/.mcp-auth/mcp-remote-<version>/`** (override the root with env `MCP_REMOTE_CONFIG_DIR`). Debug logs: `~/.mcp-auth/mcp-remote-<version>/{server_hash}_debug.log` with `--debug`. Stale state is still cleared with `rm -rf ~/.mcp-auth`.
- **Session keying**: each unique combination of server URL, `--resource` value, and custom headers maintains a separate OAuth session and token store (`--resource https://tenant1.atlassian.net/` isolates per-tenant sessions).
- **Transport strategy** (`--transport`): `http-first` (default; falls back to SSE on HTTP 404), `sse-first` (falls back to HTTP on 405), `http-only`, `sse-only`.
- **Other flags**: `--header "Name: Value"` (custom headers / bypass OAuth — note the documented Cursor/Claude-Desktop space-mangling bug; put the value in an env var and use `"Authorization:${AUTH_HEADER}"`), `--allow-http` (trusted private networks only), `--silent`, `--enable-proxy` (honors `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`), `--ignore-tool <pattern>` (wildcard filter applied to `tools/list` and `tools/call`), `--static-oauth-client-metadata '<json|@file>'`, `--static-oauth-client-info '<json|@file>'` (pre-registered clients), `NODE_EXTRA_CA_CERTS` for VPN CAs.
- **Headless caveat**: the OAuth dance itself needs a browser once; after that, cached tokens in `~/.mcp-auth` make subsequent runs non-interactive (until refresh fails). For fully browserless service auth against Atlassian, use its API-token mode instead (below).

### Atlassian remote MCP specifics

- Endpoints: **`https://mcp.atlassian.com/v1/mcp/authv2`** (recommended, Streamable HTTP), `https://mcp.atlassian.com/v1/mcp` also supported (e.g., API-token configurations). Legacy `https://mcp.atlassian.com/v1/sse` is deprecated and unsupported after **2026-06-30**.
- Auth: **OAuth 2.1** (browser 3LO; the MCP "app" is installed just-in-time on first consent) or **API token** for headless/service use — an org admin must enable it (Atlassian Administration → Rovo → Rovo MCP server → Authentication); Jira Service Management and Bitbucket tools are API-token-only, Compass tools OAuth-only.
- Bridge invocation: `npx -y mcp-remote@latest https://mcp.atlassian.com/v1/mcp/authv2` (Node ≥ 18).

## Retrieval surface

### Wire methods (legacy era, minimal payloads)

| JSON-RPC method | Kind | Minimal `params` | Result shape |
|---|---|---|---|
| `initialize` | request (MUST be first) | `{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"x","version":"0"}}` | `{protocolVersion, capabilities, serverInfo, instructions?}` |
| `notifications/initialized` | notification (after init result) | — | none (HTTP: `202 Accepted`) |
| `tools/list` | request | `{}` or `{"cursor":"…"}` | `{tools:[{name,description?,inputSchema,outputSchema?}], nextCursor?}` |
| `tools/call` | request | `{"name":"tool_name","arguments":{…}}` | `{content:[…], structuredContent?, isError?}` |
| `resources/list` / `resources/read` | request | `{}` / `{"uri":"…"}` | lists / `{contents:[…]}` |
| `prompts/list` / `prompts/get` | request | `{}` / `{"name":"…"}` | lists / `{messages:[…]}` |

`CallToolResult.content` is an array of typed blocks — `{type:"text",text}`, `{type:"image",data,mimeType}`, `{type:"audio",…}`, `{type:"resource_link",…}`, `{type:"resource",resource:{uri,text|blob}}`. Two distinct error channels (spec `server/tools`):

1. **Protocol error** → JSON-RPC `error` object. The spec assigns `-32602` to invalid params, but the channel an unknown tool or bad argument actually takes is **server-dependent**. The reference Python server funnels every `tools/call` handler failure — unknown tool name, missing required argument, wrong-typed argument — into a successful response with `isError: true` (`lowlevel/server.py` wraps all handler exceptions), and its FastMCP layer silently ignores extra or misspelled argument names. That behavior was verified only against the local `mcp` 1.29.0 fixture in `.prototype/002-mcp-headless-client/`; live Atlassian Rovo behavior for the same invalid calls is unverified. A deterministic client therefore must (a) validate arguments client-side against the exact tool `inputSchema` returned by the connected server's `tools/list`, and (b) classify both JSON-RPC errors and `isError` content; it cannot key retry policy on exception type or assume the local fixture's channel.
2. **Tool execution error** → a *successful* JSON-RPC response whose result has `"isError": true` and the failure message in `content`. **SDK `callTool` does not throw for this case — the script must check `isError`.**

### Streamable HTTP wire requirements (client-side, legacy era)

| Requirement | Exact value |
|---|---|
| Request header on every POST | `Accept: application/json, text/event-stream` (both MUST be listed) |
| Body | exactly one JSON-RPC request/notification/response per POST |
| Protocol version header (all requests after init) | `MCP-Protocol-Version: 2025-11-25` (negotiated value); a server that gets none SHOULD assume `2025-03-26`; invalid/unsupported → `400 Bad Request` |
| Session header | echo `Mcp-Session-Id: <id>` on every subsequent request if the initialize *response* carried it; missing when required → 400; expired → **404** (client MUST re-initialize) |
| Session teardown | HTTP `DELETE` to the MCP endpoint with `Mcp-Session-Id` (server MAY answer 405) |
| Listening (optional) | HTTP `GET` with `Accept: text/event-stream` opens a server→client stream, or 405 if unsupported; resume with `Last-Event-ID` |

(2026-07-28-era servers additionally require `Mcp-Method: <method>` and, for `tools/call`/`resources/read`/`prompts/get`, `Mcp-Name: <name|uri>` headers on POSTs — v1 SDKs never send these, which is one reason v1 clients cannot talk to modern-only servers.)

### TypeScript client API (`@modelcontextprotocol/sdk` 1.30.0)

| Item | Exact form |
|---|---|
| Imports | `import { Client } from '@modelcontextprotocol/sdk/client/index.js';`<br>`import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';`<br>`import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';`<br>`import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';` (legacy)<br>Types/schemas: `@modelcontextprotocol/sdk/types.js` |
| Install | `npm install @modelcontextprotocol/sdk zod` (zod is a required peer dep, ≥ 3.25) |
| Construct | `new Client({ name, version }, { capabilities?: {…} })` |
| Connect | `await client.connect(transport, options?: RequestOptions)` — performs `initialize` + `notifications/initialized`; throws (and auto-`close()`s) if the server's `protocolVersion` is unsupported |
| List tools | `await client.listTools(params?: { cursor?: string }, options?: RequestOptions)` |
| Call tool | `await client.callTool({ name, arguments }, resultSchema?, options?: RequestOptions)` — validates `structuredContent` against the tool's `outputSchema` (cached from `listTools`); throws `McpError(InvalidRequest)` if an output-schema tool returns neither `structuredContent` nor `isError` |
| Cleanup | `await client.close()` (closes transport); `StreamableHTTPClientTransport.terminateSession()` sends the session DELETE |
| Per-request options (`RequestOptions`) | `timeout` ms (default `DEFAULT_REQUEST_TIMEOUT_MSEC = 60000`), `resetTimeoutOnProgress` (default `false`), `maxTotalTimeout` (unset = none), `signal: AbortSignal`, `onprogress` |
| Error type | `McpError extends Error` with `.code`/`.data`; SDK-local codes `ConnectionClosed = -32000`, `RequestTimeout = -32001`; JSON-RPC codes `-32700/-32600/-32601/-32602/-32603`; `UrlElicitationRequired = -32042` |
| StreamableHTTP transport options | `authProvider`, `requestInit`, `fetch`, `sessionId`, `reconnectionOptions` (defaults `{initialReconnectionDelay: 1000, maxReconnectionDelay: 30000, reconnectionDelayGrowFactor: 1.5, maxRetries: 2}`) |
| Stdio transport options | `{ command, args?, env?, cwd?, stderr? }` — `stderr` default `'inherit'`; `connect()` calls `transport.start()` (spawns the child) automatically |

**v2 exists**: `@modelcontextprotocol/client` 2.0.0 (docs at `ts.sdk.modelcontextprotocol.io/v2/`, implementing the 2026-07-28 spec). Its published subpath exports are `.`, `./stdio`, `./_shims`, and `./validators/*` — there is **no** `./streamableHttp` subpath; anything not under `./stdio` comes from the root export. Its full client API surface was not verified for this chapter — treat any v2 specifics beyond package name/version/exports as (unverified).

### Python client API (`mcp` 1.x — pin `mcp>=1.29,<2`)

| Item | Exact form |
|---|---|
| Imports | `from mcp import ClientSession, StdioServerParameters, types`<br>`from mcp.client.stdio import stdio_client`<br>`from mcp.client.streamable_http import streamable_http_client` (old name `streamablehttp_client` is a deprecated alias)<br>`from mcp.client.sse import sse_client` (legacy transport) |
| Streamable HTTP connect | `async with streamable_http_client(url, http_client=None, terminate_on_close=True) as (read, write, get_session_id):` — default httpx client timeouts: **30.0 s** general, **300.0 s** SSE read (`MCP_DEFAULT_TIMEOUT`, `MCP_DEFAULT_SSE_READ_TIMEOUT`) |
| stdio connect | `async with stdio_client(StdioServerParameters(command=…, args=[…])) as (read, write):` |
| Session | `async with ClientSession(read, write, read_timeout_seconds: timedelta | None = None) as session:` then **`await session.initialize()`** (explicit — not automatic) |
| List tools | `await session.list_tools()` → `.tools[]`; overloads accept a `cursor` or `params=` |
| Call tool | `await session.call_tool(name, arguments=None, read_timeout_seconds=None, progress_callback=None, meta=None)` → `types.CallToolResult` with `.content` (e.g. `types.TextContent.text`), `.structuredContent`, `.isError` — **does not raise on `isError`** |
| v2 (for reference) | `from mcp import Client; async with Client(…) as client: result = await client.call_tool("add", {"a": 1, "b": 2})` → `result.structured_content` — the README example passes an in-memory server object; a URL-string target is v2's remote path (unverified) |

## Pagination

MCP list operations (`tools/list`, `resources/list`, `resources/templates/list`, `prompts/list`) use opaque cursor pagination:

- Response MAY carry `nextCursor`; continue with `{"cursor": "<value>"}` in the next request's params.
- **Missing `nextCursor` = end of results. An empty-string cursor is a *valid* cursor and MUST NOT be treated as the end.**
- Page size is server-controlled; clients MUST NOT assume a fixed size and MUST NOT parse or fabricate cursors.
- Invalid cursor → JSON-RPC error `-32602` (Invalid params).

Loop shape (either SDK): call list → append → if `nextCursor` present, re-call with it → stop when absent. `tools/call` results are never paginated.

## Rate limits

**The MCP protocol defines no rate-limit mechanism** — no budget fields, no throttle headers, no standard 429 semantics; none of the fetched spec pages (2025-11-25 or 2026-07-28) mention client rate limiting. Everything is backend-specific HTTP behavior underneath the transport:

| Layer | Published limit | Headers | Verified behavior |
|---|---|---|---|
| MCP spec (any revision) | none | none | Rate limiting is out of protocol scope |
| `@modelcontextprotocol/sdk` 1.30.0 client transport | n/a | n/a | **No handling of HTTP 429 or `Retry-After` anywhere in `client/streamableHttp.ts`; failed POSTs are never re-sent.** The only retry logic is SSE stream reconnection (max 2 attempts by default) |
| `mcp-remote` 0.1.38 | n/a | n/a | README documents no 429/backoff handling (unverified absence — README-level check only) |
| Atlassian Rovo MCP endpoint | plan-tiered per-hour site limits; 429 responses observed | see companion chapter | Covered with numbers and header names in [atlassian-rovo-mcp.md](atlassian-rovo-mcp.md); official docs publish no per-header budget observation mechanism |

Consequences: **the script/scheduler owns all rate-limit awareness.** Observing remaining budget cheaply is impossible at the MCP layer — there is no `rate_limit` tool or metadata; you must count your own calls and react to backend 429s (and their `Retry-After`, when present) surfaced as transport errors.

## Deterministic retrieval recipes

### 1. Raw curl session against any legacy Streamable HTTP server

```bash
MCP=https://example.com/mcp   # single MCP endpoint
# 1) initialize — capture the session header
SESSION=$(curl -sD - -o /dev/null "$MCP" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"probe","version":"0.0.1"}}}' \
  | awk 'tolower($1)=="mcp-session-id:"{print $2}' | tr -d '\r')
# 2) initialized notification (expect HTTP 202, empty body)
curl -s -o /dev/null -w '%{http_code}\n' "$MCP" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION" -H 'MCP-Protocol-Version: 2025-11-25' \
  --data '{"jsonrpc":"2.0","method":"notifications/initialized"}'
# 3) list tools (server may answer as JSON or as an SSE stream — check Content-Type)
curl -s "$MCP" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SESSION" -H 'MCP-Protocol-Version: 2025-11-25' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

If the response is `text/event-stream`, the JSON-RPC response is in the `data:` field of an SSE event — strip `event:`/`data:` framing before `jq`.

### 2. TypeScript end-to-end: Atlassian via mcp-remote (stdio bridge)

```typescript
// npm install @modelcontextprotocol/sdk zod   (SDK 1.30.0)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', 'mcp-remote@latest', 'https://mcp.atlassian.com/v1/mcp/authv2'],
  // env is NOT fully inherited by default; add what mcp-remote needs:
  env: { ...process.env as Record<string, string> },
});
const client = new Client({ name: 'harness-probe', version: '1.0.0' });

try {
  await client.connect(transport);            // initialize + notifications/initialized
  const { tools } = await client.listTools(); // first page
  console.log(tools.map(t => t.name));

  const result = await client.callTool(
    { name: 'getAccessibleAtlassianResources', arguments: {} },
    undefined,
    { timeout: 120_000 },                     // default is 60_000 ms — set explicitly
  );
  if (result.isError) {                       // tool-level failure: NOT an exception
    const msg = (result.content as Array<{ type: string; text?: string }>)
      .filter(c => c.type === 'text').map(c => c.text).join('\n');
    throw new Error(`tool failed: ${msg}`);
  }
  for (const block of result.content as Array<{ type: string; text?: string }>) {
    if (block.type === 'text') console.log(JSON.parse(block.text!)); // many servers put JSON in text blocks
  }
} finally {
  await client.close();                       // kills the mcp-remote child
}
```

First run triggers mcp-remote's browser OAuth (tokens cached in `~/.mcp-auth`); later runs are non-interactive. For a direct Streamable HTTP connection with a static token instead, swap the transport:

```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const transport = new StreamableHTTPClientTransport(new URL('https://example.com/mcp'), {
  requestInit: { headers: { Authorization: `Bearer ${process.env.TOKEN}` } },
});
```

### 3. Python equivalent (mcp>=1.29,<2)

```python
import asyncio
from datetime import timedelta
from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client

params = StdioServerParameters(
    command="npx", args=["-y", "mcp-remote@latest", "https://mcp.atlassian.com/v1/mcp/authv2"]
)

async def main() -> None:
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=120)) as session:
            await session.initialize()
            tools = await session.list_tools()
            print([t.name for t in tools.tools])
            result = await session.call_tool("getAccessibleAtlassianResources", arguments={})
            if result.isError:
                raise RuntimeError([c.text for c in result.content if isinstance(c, types.TextContent)])
            for c in result.content:
                if isinstance(c, types.TextContent):
                    print(c.text)

asyncio.run(main())
```

### 4. Smoke tests

```bash
# mcp-remote's built-in client: full OAuth flow + list tools/resources, verbose logs
npx -p mcp-remote@latest mcp-remote-client https://mcp.atlassian.com/v1/mcp/authv2
# reset cached OAuth state when auth loops or token exchange fails
rm -rf ~/.mcp-auth
```

## Scheduler implications

- **One `initialize` handshake per session, strictly first.** No other request may be issued before the initialize result + `notifications/initialized` (legacy era). Serialize session bring-up; only then fan out.
- **Session affinity**: if the server issues `Mcp-Session-Id`, every request must echo it. A 404 on any call means the session is dead — the scheduler must re-run `initialize` (new session) and re-issue the call, not blind-retry.
- **The SDKs retry nothing that matters.** TS SDK 1.30.0 never re-sends a failed POST and has no 429/`Retry-After` logic; its only built-in retry is SSE stream reconnection (default: 2 attempts, 1 s initial delay, ×1.5 growth, 30 s cap, server SSE `retry:` overrides). All request-level retries, backoff, and rate-limit budgeting belong to the scheduler.
- **Timeouts**: default per-request timeout is 60 000 ms (TS, `McpError` code `-32001` on expiry) / 30 s HTTP + 300 s SSE-read (Python httpx defaults; per-call `read_timeout_seconds` unset by default). Set explicit timeouts per tool call; use `resetTimeoutOnProgress: true` + `maxTotalTimeout` for long-running tools that emit progress.
- **Bound every result before parsing or retaining it**: set an application-owned maximum for HTTP response bytes and for the number/size of `CallToolResult.content` blocks and `structuredContent`. An oversize result is incomplete and must be cancelled or rejected, never truncated into success, sent to a healer, or passed to inference. Bound and redact any diagnostic excerpt independently.
- **Concurrency**: multiple in-flight `tools/call`s on one client are legal (distinct JSON-RPC ids; request IDs must never be reused within a session) but share one session and one backend budget. Cap per-session concurrency to whatever the backend tolerates (Atlassian: see the companion chapter's hourly plan limits).
- **mcp-remote is per-URL child-process state**: one spawned bridge per server URL/`--resource` combination; `~/.mcp-auth` is global shared state keyed by server hash — never run two concurrent first-time auth flows for the same server, and treat token refresh as single-flight.
- **stdio hygiene**: the child's stdout is protocol-only; stderr may be noisy and is not an error signal. Don't parse stderr for health.
- **Cancellation owns cleanup**: when the pipeline deadline or caller cancellation fires, stop new tool calls and retry admission, cancel the request, close the session/transport opened by the adapter, and terminate/drain an owned stdio bridge within bounded limits. A late JSON-RPC result cannot revive a cancelled shard.
- **Pin protocol era**: v1 SDK clients cannot reach modern-only (2026-07-28) servers, and v2 clients handle both; if a backend upgrades, the failure mode is a 400 with a modern JSON-RPC error body — detect and escalate rather than retry.

## Failure modes and healing signals

| Wire signature | Meaning | Healing action |
|---|---|---|
| HTTP 401 (+ `WWW-Authenticate`) on POST | OAuth required/expired; TS SDK throws `UnauthorizedError` when no `authProvider` | Re-run auth (mcp-remote: delete `~/.mcp-auth` if refresh loops); attach `authProvider` or static header |
| HTTP 400 on POST | Missing/invalid `Mcp-Session-Id` or `MCP-Protocol-Version`; on modern servers, missing `_meta`/`Mcp-Method` headers | Verify handshake ran; check protocol-era mismatch (inspect body for JSON-RPC error `-32022` `UnsupportedProtocolVersion` → server is modern-only; switch to a v2 client) |
| HTTP 404 with a previously valid `Mcp-Session-Id` | Session expired/terminated | Start a new session (`initialize` again), then re-issue the request; SDK `connect()` on a fresh transport does this |
| HTTP 405 on GET | Server offers no standalone SSE stream (normal for stateless servers) | Ignore; not an error for request/response usage |
| HTTP 404 (endpoint) with `--transport http-first` | Server is legacy HTTP+SSE only | mcp-remote falls back to SSE automatically; direct SDK: use `SSEClientTransport` fallback on 4xx |
| HTTP 429 (+ optional `Retry-After`) | Backend rate limit (e.g., Atlassian) — surfaces as a transport error; SDK will not back off | Scheduler: honor `Retry-After` if present, else exponential backoff; reduce session concurrency |
| JSON-RPC `error` `-32602` | Invalid params or cursor; an unknown tool may instead be `isError`, depending on the server | Fix the call; do not retry unchanged |
| JSON-RPC `error` `-32601` | Method not found (e.g., wrong era or capability) | Check server capabilities from initialize result |
| Result with `"isError": true` | Tool executed and failed; message in `content[].text` | Parse text, decide retry-ability per tool semantics; **not** signaled as an exception by either SDK |
| `McpError` code `-32001` (`RequestTimeout`), local | SDK-side timeout expired (no wire message) | Increase `timeout`/`read_timeout_seconds`; for progress-emitting tools use `resetTimeoutOnProgress` |
| `McpError` code `-32000` (`ConnectionClosed`) / stdio child exit | Transport died (process crash, network drop) | Respawn/reconnect; a broken SSE response stream loses the in-flight request — re-issue it with a new request id |
| `onerror: "Maximum reconnection attempts (2) exceeded."` | TS SDK gave up resuming an SSE stream | Treat associated in-flight requests as lost; re-issue |
| mcp-remote `/callback` page shows `Token exchange failed: HTTP 400` | Stale/corrupt cached OAuth state | `rm -rf ~/.mcp-auth`, restart, redo browser flow |
| Verbose noise on stderr from a stdio server | Normal logging | Ignore (spec: SHOULD NOT be assumed to indicate errors) |

## Sources

All accessed 2026-08-12. Cached extractions/raw copies live under `.web-docs/raw-specification-*` (spec pages), `raw-python-sdk-*`, `raw-mcp-remote-readme.md`, `raw-atlassian-mcp-server-README.md`, and the `conv-*` Atlassian-doc extractions. (TypeScript-SDK sources were verified directly against `raw.githubusercontent.com` at ref `1.30.0`; no local cache copy.)

| URL | Grounded |
|---|---|
| https://modelcontextprotocol.io/docs/getting-started/intro (+ https://modelcontextprotocol.io/llms.txt) | MCP overview; current doc/spec revision paths (`2026-07-28`) |
| https://modelcontextprotocol.io/specification/2026-07-28/changelog.md | Stateless redesign, removal of `initialize`/`Mcp-Session-Id`, `server/discover`, SSE-resumability removal, error-code reallocation, HTTP+SSE deprecation |
| https://modelcontextprotocol.io/specification/2026-07-28/basic/index.md | JSON-RPC message rules, `resultType`, error-code table (`-32020/-32021/-32022`), `_meta` per-request fields |
| https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning.md | Modern/legacy/dual-era terminology, compatibility matrix, `-32022` error shape |
| https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http.md | `Mcp-Method`/`Mcp-Name` headers, `MCP-Protocol-Version: 2026-07-28`, 400 semantics |
| https://modelcontextprotocol.io/specification/2026-07-28/server/tools.md | Protocol-error vs `isError` tool-execution-error split; `-32602` for invalid params |
| https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination.md | Cursor mechanics, empty-cursor rule, `-32602` on invalid cursor |
| https://modelcontextprotocol.io/specification/2025-11-25/basic/transports.md | Legacy Streamable HTTP: Accept header, 202, SSE-or-JSON responses, `Mcp-Session-Id` lifecycle (400/404/DELETE/405), `MCP-Protocol-Version` fallback `2025-03-26`, `Last-Event-ID` resumability, stdio rules, HTTP+SSE fallback probe |
| https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle.md | `initialize` request/response fields and `notifications/initialized` |
| https://github.com/modelcontextprotocol/typescript-sdk (README + docs/client.md + src at ref `1.30.0`) | Import paths; `Client`/`connect`/`listTools`/`callTool` signatures; `LATEST_PROTOCOL_VERSION='2025-11-25'`; `SUPPORTED_PROTOCOL_VERSIONS`; `DEFAULT_REQUEST_TIMEOUT_MSEC=60000`; `RequestOptions`; `ErrorCode` enum; reconnection defaults `{1000, 30000, 1.5, 2}`; absence of 429/POST-retry handling; `terminateSession()`; stdio env filtering; stderr default |
| https://registry.npmjs.org/@modelcontextprotocol/sdk, …/@modelcontextprotocol/client, …/mcp-remote | Version pins: sdk 1.30.0, client 2.0.0, mcp-remote 0.1.38 (published 2026-02-05) |
| https://ts.sdk.modelcontextprotocol.io/ (v2 docs landing) | v2 package names `@modelcontextprotocol/client`/`server`; v2 targets 2026-07-28 spec |
| https://github.com/modelcontextprotocol/python-sdk (README `main` + `v1.x` README/docs/client.md + `v1.x` src) | v2.0.0 status + `mcp>=1.29,<2` pin guidance; v1 imports (`ClientSession`, `stdio_client`, `streamable_http_client` with deprecated `streamablehttp_client` alias); `MCP_DEFAULT_TIMEOUT=30.0`/`MCP_DEFAULT_SSE_READ_TIMEOUT=300.0`; `call_tool`/`list_tools` signatures; `CallToolResult` parsing incl. `isError` |
| https://pypi.org/pypi/mcp/json | PyPI `mcp` latest 2.0.0; last 1.x release 1.29.0; Python ≥ 3.10 |
| https://github.com/geelen/mcp-remote (README, `main`) | All mcp-remote flags, port 3334 default, `~/.mcp-auth` + `MCP_REMOTE_CONFIG_DIR`, debug log path, transport strategies (404/405 fallbacks), `--auth-timeout` 30 s, session keying, `mcp-remote-client` smoke test, token-exchange-failed healing (npmjs.com page itself returned HTTP 403 to non-browser fetch) |
| https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/ and …/docs/setting-up-ides/ | Atlassian endpoints (`/v1/mcp/authv2`, `/v1/mcp`), `/v1/sse` deprecation after 2026-06-30, Node ≥ 18, OAuth 2.1, mcp-remote invocations |
| https://github.com/atlassian/atlassian-mcp-server (README, `main`) | OAuth 2.1 vs API-token auth split (JSM/Bitbucket token-only, Compass OAuth-only), admin enablement path, JIT install, `maxResults: 10`/`limit: 10` search guidance, endpoint equivalence notes |
