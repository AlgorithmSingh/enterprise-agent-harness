# Prototype 002 — Headless MCP client spike

**Status:** complete · **Date:** 2026-08-12 · **Kind:** design instrument, not production code

This is prototype-assisted design. Nothing here is intended to ship. It exists to
contract-check `docs/book/mcp-client-mechanics.md` and `docs/book/atlassian-rovo-mcp.md`
against the packages that are actually installable today.

---

## Question

Can a deterministic Python script — no LLM in the loop — drive an MCP server with the
current `mcp` Python SDK? And is what the book chapter claims about import paths, session
APIs, result types, and the `mcp-remote` bridge true against the actually-installed packages?

## Provisional contract (what the book asserts, going in)

1. A script can drive `tools/list` and `tools/call` like any RPC API; the SDK needs no model.
2. Python v1 imports: `from mcp import ClientSession, StdioServerParameters, types`,
   `from mcp.client.stdio import stdio_client`,
   `from mcp.client.streamable_http import streamable_http_client`.
3. `ClientSession(read, write, read_timeout_seconds: timedelta | None)`, then an **explicit**
   `await session.initialize()`.
4. `call_tool(...) -> types.CallToolResult` with `.content` / `.structuredContent` / `.isError`,
   and **it does not raise on `isError`**.
5. Two error channels: protocol errors become JSON-RPC `error` objects (`-32602` cited for an
   unknown tool name or invalid params); tool-execution errors become successful responses
   carrying `isError: true`.
6. `mcp` 2.0.0 is PyPI `latest`; pin `mcp>=1.28,<2` for the v1 `ClientSession` API.
7. `mcp-remote` 0.1.38 bridges stdio→remote with OAuth, listening on **localhost:3334** by
   default, storing state in `~/.mcp-auth`, with a documented flag set.

## What was tested

Two isolated `uv` venvs inside `spike/`, no system interpreter touched:

| venv | install command | resolved |
|---|---|---|
| `spike/.venv` | `uv pip install mcp` (unpinned) | **mcp 2.0.0**, mcp-types 2.0.0, httpx2 2.10.0 |
| `spike/.venv-v1` | `uv pip install 'mcp>=1.28,<2'` | **mcp 1.29.0**, httpx 0.28.1 |

Both on CPython 3.12.11. Four instruments, all offline:

- `spike/introspect_sdk.py` — imports and introspects the real surface (import paths,
  signatures, constants, pydantic model fields) and emits one JSON report. Run against both
  venvs and diffed.
- `spike/echo_server.py` + `spike/roundtrip_test.py` — a FastMCP server with `echo`,
  `echo_structured` (declares an outputSchema) and `always_fails`, driven end-to-end over the
  **real stdio transport** by a deterministic client, asserting 12 typed contracts.
- `spike/error_channels.py` — maps which failure mode takes which error channel, against both
  the FastMCP server and a bare low-level `Server` with no handlers registered.
- `spike/roundtrip_v2.py` — the same round trip through mcp 2.0.0's `Client` + `MCPServer`
  in-process API.
- `spike/mcp_remote_port.py` — reimplements mcp-remote's callback-port derivation offline.

**Network discipline.** The only sockets opened were to the npm and PyPI registries (package
metadata and installs, explicitly allowed). The protocol round trips talk to a local
subprocess over stdio pipes; the v2 round trip is in-process. **No request was made to
`mcp.atlassian.com` or any authenticated remote service.**

## Evidence

### The headline: a real, no-LLM protocol round trip works

```
$ .venv-v1/bin/python roundtrip_test.py        # -> out-roundtrip-v1.json
v1 round trip: 11/12
  FAIL (expected): BOOK CLAIM: unknown tool name surfaces as a protocol error (McpError)
```

Eleven of twelve contracts hold exactly as written, including the negotiated handshake
(`protocolVersion: 2025-11-25`), typed `Tool` objects with `inputSchema`, verbatim payload
round-trip, `structuredContent` population from an outputSchema tool, and — the operationally
important one — a raising tool producing `isError: true` **without** throwing client-side. The
single failure is a genuine book error, detailed below.

### Installed versions

```
$ uv pip install mcp            -> mcp==2.0.0   (confirms 2.0.0 is `latest`)
$ uv pip install 'mcp>=1.28,<2' -> mcp==1.29.0  (confirms 1.29.0 is the last 1.x)
Requires-Python: >=3.10 (both)
$ npm view mcp-remote version   -> 0.1.38   (time.modified 2026-02-05T23:21:45Z)
```

### Signatures, verbatim from `inspect` (mcp 1.29.0)

```
streamable_http_client(url: str, *, http_client: httpx.AsyncClient | None = None,
                       terminate_on_close: bool = True)
stdio_client(server: StdioServerParameters, errlog: TextIO = <stderr>)
ClientSession.__init__(self, read_stream, write_stream,
                       read_timeout_seconds: datetime.timedelta | None = None, ...)
ClientSession.initialize(self) -> mcp.types.InitializeResult          [async]
ClientSession.list_tools(self, cursor: str | None = None, *,
                         params: PaginatedRequestParams | None = None)  [async]
ClientSession.call_tool(self, name: str, arguments: dict | None = None,
                        read_timeout_seconds: timedelta | None = None,
                        progress_callback: ProgressFnT | None = None, *,
                        meta: dict | None = None) -> types.CallToolResult  [async]
```

`CallToolResult` fields in v1: `content` (required), `structuredContent`, `isError`, `meta`
(alias `_meta`). `ListToolsResult`: `tools`, `nextCursor`, `meta`.

### Error-channel map (`out-error-channels-v1.json`)

| Failure | Channel actually taken |
|---|---|
| unknown tool name | `isError: true` result, **no exception** — `"Unknown tool: no_such_tool"` |
| missing required argument | `isError: true` result, pydantic validation text |
| argument of wrong type | `isError: true` result, pydantic validation text |
| **unexpected extra argument** | **`isError: false` — silently accepted and ignored** |
| tool raises at runtime | `isError: true` result |
| any method on a server with no handlers | `McpError` raised, code **`-32601`** "Method not found" |

Root cause is in the SDK itself, not FastMCP:
`.venv-v1/.../mcp/server/lowlevel/server.py:589-590` wraps the whole tool-call handler in
`except Exception as e: return self._make_error_result(str(e))`. FastMCP's tool manager
raises `ToolError(f"Unknown tool: {name}")` (`fastmcp/tools/tool_manager.py:78`), which that
handler converts into an `isError` result.

### mcp-remote 0.1.38, checked against shipped code (not the README)

`npx -y mcp-remote --help` **does not work** — there is no help flag; argv[0] is parsed as the
URL and the process dies with `TypeError: Invalid URL … code: 'ERR_INVALID_URL', input: '--help'`.
So the flag table was verified by grepping `dist/` instead. All eleven documented flags are
present: `--transport --auth-timeout --host --header --allow-http --debug --silent
--enable-proxy --ignore-tool --static-oauth-client-metadata --static-oauth-client-info`, as
are all four transport strategies (`http-first`, `sse-first`, `http-only`, `sse-only`),
`MCP_REMOTE_CONFIG_DIR`, and `authTimeoutMs = 3e4` (30 s, matching `--auth-timeout <seconds>`).
Both binaries exist: `mcp-remote` → `dist/proxy.js`, `mcp-remote-client` → `dist/client.js`.
The package declares **no `engines` field**, so "requires Node ≥ 18" is a README claim, not
metadata-enforced.

The default callback port is **not 3334**. From `dist/chunk-65X3S4HB.js`:

```js
function getServerUrlHash(serverUrl, authorizeResource, headers) { /* … */
  return crypto.createHash("md5").update(parts.join("|")).digest("hex"); }
function calculateDefaultPort(serverUrlHash) {
  const offset = parseInt(serverUrlHash.substring(0, 4), 16);
  return 3335 + offset % 45816; }
```

`mcp_remote_port.py` reimplements this and agrees with Node's own `crypto` byte for byte:

| Endpoint | md5 hash | preferred default port |
|---|---|---|
| `https://mcp.atlassian.com/v1/mcp/authv2` | `8d8bab2a93ad41172215aecfb4b6d869` | **39570** |
| `https://mcp.atlassian.com/v1/mcp` | `01910c24c5f2edcaf999bd1eaaeaeee8` | **3736** |

The possible range is 3335–49150; **3334 is not in it**. Resolution order is explicit
positional port argument → cached `existingClientPort` → hash-derived port (or another open
port if that one is busy). Config dir is `~/.mcp-auth/mcp-remote-${version}`, i.e.
`~/.mcp-auth/mcp-remote-0.1.38/`, not `~/.mcp-auth/` directly.

### v1 → v2 is a silent breaking change

Running the book's own Python recipe under mcp 2.0.0:

```
ImportError: cannot import name 'McpError' from 'mcp'. Did you mean: 'MCPError'?
```

| Surface | mcp 1.29.0 | mcp 2.0.0 |
|---|---|---|
| result flags | `.isError`, `.structuredContent` | `.is_error`, `.structured_content` |
| error class | `McpError` | `MCPError` (`mcp.shared.exceptions`) |
| `ClientSession.read_timeout_seconds` | `timedelta \| None` | `float \| None` |
| `ClientSession.list_tools` | `(cursor=None, *, params=None)` | `(*, params=None)` — positional cursor gone |
| `streamablehttp_client` alias | present, `@deprecated` | **removed** |
| `mcp.server.fastmcp` | present | **removed** — replaced by `mcp.server.mcpserver.MCPServer` |
| `streamable_http_client(http_client=)` | `httpx.AsyncClient` | `httpx2.AsyncClient` |
| `types.LATEST_PROTOCOL_VERSION` | `2025-11-25` | `2026-07-28` |
| high-level client | — | `Client(server: Server \| MCPServer \| Transport \| str)` |

`roundtrip_v2.py` scores 8/9: v2's `Client` works in-process, `structured_content` is
populated, and a failing tool still yields `is_error: true` **without raising**. The ninth
check was my hypothesis that v2's new `raise_exceptions=True` would convert tool failures into
exceptions — **it does not**. That flag only reaches `InMemoryTransport(raise_handler_exceptions=…)`,
and the SDK carries its own `# TODO(Marcelo): When do raise_exceptions=True actually raises?`
at `mcp/client/client.py:296`. So "check `isError` yourself" holds in **both** major versions.

---

## Claim-by-claim verdict

### CONFIRMED

- **A deterministic, no-LLM script drives a real MCP server end to end.** Proven by a live
  stdio round trip, not by reading docs.
- `mcp` PyPI `latest` = **2.0.0**; `mcp>=1.28,<2` → **1.29.0**, the last 1.x; `Requires-Python >=3.10`.
- All v1 import paths exactly as written: `mcp.{ClientSession,StdioServerParameters,types}`,
  `mcp.client.stdio.stdio_client`, `mcp.client.streamable_http.streamable_http_client`,
  `mcp.client.sse.sse_client`.
- `streamable_http_client(url, http_client=None, terminate_on_close=True)` — exact
  (both options are keyword-only, which the book's usage already respects).
- `streamablehttp_client` is deprecated and its `headers`/`timeout`/`sse_read_timeout`/`auth`
  parameters **are** ignored with a runtime warning — verbatim: *"Parameters … are deprecated
  and will be ignored."*
- `ClientSession(read, write, read_timeout_seconds: timedelta | None = None)` and the
  **explicit** `await session.initialize()` requirement.
- `list_tools()` accepting either a positional `cursor` or `params=` (v1).
- `call_tool(name, arguments, read_timeout_seconds, progress_callback, meta)` — exact, with
  `meta` keyword-only.
- `CallToolResult.content` / `.structuredContent` / `.isError`; missing `nextCursor` = end of results.
- **`call_tool` does not raise on `isError`** — the chapter's most load-bearing operational
  claim, confirmed by live round trip in v1 *and* v2.
- Default timeouts **30.0 s / 300.0 s** under exactly the names `MCP_DEFAULT_TIMEOUT` and
  `MCP_DEFAULT_SSE_READ_TIMEOUT` (they live in `mcp.shared._httpx_utils`, a private module).
- Protocol-era table: v1 `LATEST_PROTOCOL_VERSION = 2025-11-25`, v2 `= 2026-07-28`;
  `DEFAULT_NEGOTIATED_VERSION = 2025-03-26` corroborates the "server that gets none assumes
  2025-03-26" rule.
- v2 reference row: `from mcp import Client`, in-memory server target, `result.structured_content`.
  The `str` (URL) target the book flagged unverified **is** in the signature —
  `Client(server: Server[Any] | MCPServer | Transport | str)` — though its runtime behavior needs a network.
- mcp-remote **0.1.38**, published 2026-02-05; all 11 documented flags and all 4 transport
  strategies present in shipped code; `--auth-timeout` default **30 s**; `MCP_REMOTE_CONFIG_DIR`
  override; session keyed by URL + `--resource` + custom headers (`getServerUrlHash`);
  `mcp-remote-client` smoke-test binary exists.

### CONTRADICTED

1. **"Protocol error → JSON-RPC `error` (e.g. `-32602` for an unknown tool name / invalid
   params)."** Against the Python reference server this is false. An unknown tool name, a
   missing required argument, and a wrong-typed argument **all** return a successful response
   with `isError: true`; none raises. The two-channel model itself is real — a bare low-level
   server does raise `McpError(-32601)` — but **nothing in the `tools/call` path produces a
   protocol error**, because `lowlevel/server.py:589` funnels every handler exception into
   `isError`. Correction needed: the channel an unknown tool takes is **server-dependent**, and
   the reference Python implementation chooses `isError`. A scheduler must therefore parse
   `isError` text to distinguish "my tool name is wrong" (never retry) from "the tool failed"
   (maybe retry) — it cannot rely on catching an exception.

2. **"mcp-remote listens for the redirect on `localhost:3334` by default."** False in the
   shipped 0.1.38 code. The port is `3335 + parseInt(md5(url)[0:4], 16) % 45816` — deterministic
   per server URL, range 3335–49150, and **3334 is not in the range**. For
   `https://mcp.atlassian.com/v1/mcp/authv2` it is **39570**. `3334` appears only in
   mcp-remote's README (line 128), which the code contradicts. This has real operator impact:
   both chapters, echoing Atlassian's troubleshooting page, tell people to allowlist
   `http://localhost:3334` — the wrong port. Correction: state the derivation, give 39570 for
   the authv2 endpoint, and note that an explicit positional port argument is the only way to
   pin it.

3. **Debug-log path `~/.mcp-auth/{server_hash}_debug.log`.** Actual path is version-scoped:
   `~/.mcp-auth/mcp-remote-0.1.38/{server_hash}_debug.log` (`getConfigDir()` joins
   `mcp-remote-${version}`). `rm -rf ~/.mcp-auth` still works as the reset, so that healing
   action stands.

4. **"Pin `mcp>=1.28,<2` for the v1 `ClientSession` API"** — right advice, understated reason.
   v2 does **not** remove `ClientSession`; it keeps the name and changes the semantics, which is
   worse. `read_timeout_seconds` silently becomes `float` (the book's own `timedelta(seconds=120)`
   recipe breaks), `list_tools` loses its positional `cursor`, `.isError`/`.structuredContent`
   become `.is_error`/`.structured_content`, and `McpError` becomes `MCPError`. Correction: say
   the pin exists because v2 reuses the same import path with an incompatible API, and list the
   renames.

### Untestable offline (unchanged, still unverified)

Everything requiring the live endpoint or a browser: Atlassian endpoint behavior, OAuth 2.1
3LO and API-token modes, the tool catalog, `cloudId` requirements, rate limits
(500/1,000/10,000 per hour), 429 + `Retry-After` semantics, silent token expiry, mcp-remote's
actual browser dance and `~/.mcp-auth` token caching, and all Streamable HTTP wire requirements
(`Accept` header, `Mcp-Session-Id` lifecycle, 202/400/404/405). The TypeScript SDK 1.30.0 claims
were out of scope for this Python spike.

### New findings the book does not mention

- **Extra/misspelled tool arguments are silently ignored** (`isError: false`, tool runs with
  defaults). A typo'd parameter name is not an error — a determinism hazard worth a scheduler
  guard: validate arguments against the `inputSchema` from `tools/list` before calling.
- **`mcp.server.fastmcp` is gone in v2**, replaced by `mcp.server.mcpserver.MCPServer`. Any
  in-repo test double or fixture server built on FastMCP is pinned to v1.
- **v2 depends on `httpx2`, not `httpx`**, so a pre-configured client passed to
  `streamable_http_client` is version-specific.

---

## Decision impact

**Supports.** The core premise holds: a deterministic Python script with no model in the loop
can drive an MCP server over a real transport, and the book's v1 Python API table is accurate
almost line for line. The retrieval design can rely on `stdio_client` + `ClientSession` +
`initialize()` + `list_tools()` + `call_tool()` exactly as documented.

**Changes.**

1. The scheduler's error handling must be rebuilt around the finding that `tools/call` never
   raises. Treat `isError` as the primary failure channel and classify by message text; reserve
   exception handling for transport death and `-32601`. Retry policy cannot be keyed on
   exception type.
2. Argument validation must happen client-side against `inputSchema`, because neither wrong
   names (ignored) nor wrong types (`isError`) fail loudly enough to be distinguishable from a
   genuine tool failure.
3. Any operator runbook for the OAuth bridge must carry the derived port (39570 for authv2),
   not 3334, and the version-scoped `~/.mcp-auth/mcp-remote-<version>/` path.

**Still unknown.** Everything behind the live endpoint — auth, rate limits, real tool schemas,
429 behavior. Those need an authorized credentialed spike, which this one deliberately was not.

**Recommendation.** Pin **`mcp>=1.29,<2`** (not just `>=1.28`) and treat the pin as load-bearing
rather than stylistic, since v2 reuses `ClientSession` with an incompatible signature and would
fail at runtime, not at import, in several places. Build the harness's MCP adapter behind a thin
internal port so the v1→v2 rename set (`isError`→`is_error`, `McpError`→`MCPError`,
`timedelta`→`float`) is confined to one module when v2 becomes necessary. Correct the four
contradictions above in the book before the chapter is used as an implementation reference —
correction 1 (error channels) and correction 2 (callback port) are the two that would actually
cause defects.

## Files

```
.prototype/002-mcp-headless-client/
├── README.md                      this record
├── .gitignore                     venvs and __pycache__
└── spike/
    ├── introspect_sdk.py          offline surface introspection -> JSON
    ├── echo_server.py             minimal FastMCP stdio server (3 tools)
    ├── roundtrip_test.py          deterministic no-LLM stdio round trip, 12 contracts
    ├── error_channels.py          which failure takes which error channel
    ├── roundtrip_v2.py            same round trip on the mcp 2.0.0 Client API
    ├── mcp_remote_port.py         offline reimplementation of mcp-remote's port derivation
    ├── out-introspect-v1.json     evidence: mcp 1.29.0 surface
    ├── out-introspect-v2.json     evidence: mcp 2.0.0 surface
    ├── out-roundtrip-v1.json      evidence: 11/12, the 12th is book contradiction 1
    ├── out-roundtrip-v2.json      evidence: 8/9 on v2
    ├── out-error-channels-v1.json evidence: error-channel map
    └── out-mcp-remote-port.json   evidence: derived callback ports
```

Reproduce: `cd spike && uv venv .venv-v1 && uv pip install --python .venv-v1/bin/python 'mcp>=1.28,<2'`
then `.venv-v1/bin/python roundtrip_test.py`.
