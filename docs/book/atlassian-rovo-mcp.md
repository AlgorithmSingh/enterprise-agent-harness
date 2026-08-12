---
type: reference
title: "Atlassian Rovo MCP Server (Remote MCP)"
description: "Verified reference for the Atlassian Rovo MCP Server as a retrieval backend: endpoints, auth, complete tool list, rate limits, and scheduler constraints."
timestamp: "2026-08-12"
---

# Atlassian Rovo MCP Server (Remote MCP)

All facts below were verified against pages fetched on 2026-08-12 and cached under `.web-docs/undefined-rovo-mcp-*.md` (plus `undefined-mcp-remote-readme.md`). Anything Atlassian has not published is flagged "(unverified)" or attributed to a labeled secondary source.

## Overview

- **Official name:** *Atlassian Rovo MCP Server*. Older name "Atlassian Remote MCP Server" survives in URL slugs (`.../docs/getting-started-with-the-atlassian-remote-mcp-server/`) but the product and docs now say "Atlassian Rovo MCP Server".
- **Status:** Generally Available. The official GitHub repo (`atlassian/atlassian-mcp-server`) carries a "Status: Generally Available" badge, and Atlassian's FAQ states "All Atlassian Cloud customers have access to the Atlassian Rovo MCP server". A separate **MCP v2 Preview** endpoint exists (changelog entry 1 July 2026, early access, subject to change).
- **What it is:** a cloud-hosted remote MCP server operated by Atlassian at `mcp.atlassian.com`. There is no self-hosted component; Atlassian describes it as "a secure proxy between your AI client and your Atlassian Cloud site" that "does not store or cache your Jira or Confluence content".
- **Products reachable:** Jira, Confluence, Jira Service Management (API-token auth only), Bitbucket Cloud (API-token-with-scopes auth only), Compass (OAuth only), plus platform-level Rovo search and Teamwork Graph tools.
- **Docs locations (as read 2026-08-12):**
  - Support collection: `https://support.atlassian.com/atlassian-rovo-mcp-server/docs/...` (the bare collection root `https://support.atlassian.com/atlassian-rovo-mcp-server/` returns HTTP 404; use `/resources/` or a full doc path). The older `https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/` still serves the same getting-started content.
  - Developer portal: `https://developer.atlassian.com/cloud/rovo-mcp/` (guides, changelog, Preview docs).
  - Admin docs: `https://support.atlassian.com/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/` and `.../control-atlassian-rovo-mcp-server-settings/`.
  - Official repo: `https://github.com/atlassian/atlassian-mcp-server` (docs/skills only; the server itself is closed, cloud-hosted).
- **Role in a deterministic retrieval pipeline:** JQL/CQL search plus keyed lookups (issue key, page ID) behind the authenticated user's permissions. Determinism caveats: the `searchAtlassian`/`fetchAtlassian` tools are Rovo-powered natural-language search (beta) and are not deterministic; prefer `searchJiraIssuesUsingJql` and `searchConfluenceUsingCql` with explicit queries.

### Endpoints

| Endpoint | Purpose | Status (2026-08-12) |
|---|---|---|
| `https://mcp.atlassian.com/v1/mcp/authv2` | Recommended endpoint for most clients (OAuth 2.1, new DCR auth server) | GA, recommended |
| `https://mcp.atlassian.com/v1/mcp` | Also supported, "for example, for API token configurations" | GA |
| `https://mcp.atlassian.com/v1/sse` | Legacy SSE transport | Deprecated; docs banner: "After 30th June 2026, usage of `https://mcp.atlassian.com/v1/sse` as a server endpoint will no longer be supported." That date has passed — do not use. |
| `https://mcp.atlassian.com/v1/mcp/preview` | MCP v2 Preview (`discover`/`execute` tool model) | Preview / early access, subject to change |
| `https://mcp.atlassian.com/.well-known/oauth-protected-resource/v1/mcp/authv2` | OAuth protected-resource discovery document for the authv2 endpoint | Documented in the 27 April 2026 changelog entry |

**Transport:** clients configure the `/v1/mcp*` endpoints as `"type": "http"` (VS Code config) / `--transport http` (Claude Code). Atlassian's docs never use the phrase "Streamable HTTP" verbatim; the `/v1/sse` endpoint was the SSE transport and is now past its deprecation date. Treat `/v1/mcp*` as the MCP HTTP transport ("Streamable HTTP" naming: unverified in Atlassian docs).

## Authentication

Two methods (support doc "Authentication and authorization"):

| Method | Interactivity | Auth header sent to the server | Availability |
|---|---|---|---|
| OAuth 2.1 (primary, recommended, default) | Interactive browser consent flow | `Authorization: Bearer <access_token>` | Always on |
| Personal API token | Non-interactive (Basic auth) | `Authorization: Basic <base64(email:api_token)>` | Only if an org admin enabled API-token auth |
| Service account API key | Non-interactive (Bearer) | `Authorization: Bearer <api_key>` | Only if an org admin enabled API-token auth; "where available" |

### OAuth 2.1 flow

- The MCP client initiates the OAuth 2.1 authorization flow; the user consents in a browser; the client then sends `Authorization: Bearer <access_token>` on requests. The server "validates the token, enriches it with user and product context".
- Since **27 May 2026** the DCR OAuth provider is Atlassian Identity. Clients **must not cache** auth state, including `client_id` and the `/.well-known/oauth-authorization-server` discovery document — cached values from the old provider "will not be recognised by the new server" (changelog, 27 April 2026).
- OAuth access tokens "are typically consented for a specific **cloud ID** (site)"; the server validates that requests target the `cloudId` the token was granted for.
- Native HTTP-capable clients: `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2` then `/mcp` to authenticate; `codex mcp add atlassian --url https://mcp.atlassian.com/v1/mcp/authv2`; VS Code/Cursor one-click installs use `{"type":"http","url":"https://mcp.atlassian.com/v1/mcp"}` (VS Code gallery link) or `.../v1/mcp/authv2` (README buttons).
- Stdio-only clients bridge via **`mcp-remote`** (npm; requires Node.js v18+): `npx -y mcp-remote@latest https://mcp.atlassian.com/v1/mcp/authv2`. mcp-remote listens for the OAuth redirect on a **port derived from the server URL** — for the authv2 endpoint that is **`http://localhost:39570`**, not the `localhost:3334` that Atlassian's troubleshooting page and mcp-remote's own README claim (the shipped 0.1.38 code computes `3335 + md5(url) mod 45816`, a range that excludes 3334; verified in `.prototype/002-mcp-headless-client/`). Pin the port with an explicit positional argument after the URL when a firewall allowlist is needed; `--host` changes the callback host. **Tokens/credentials are stored in the version-scoped `~/.mcp-auth/mcp-remote-<version>/`** (root overridable via `$MCP_REMOTE_CONFIG_DIR`); `rm -rf ~/.mcp-auth` clears state; `--debug` writes `~/.mcp-auth/mcp-remote-<version>/{server_hash}_debug.log`. Note the mcp-remote README self-describes as an experimental proof-of-concept.

### API token flow (headless)

- Requires an org admin to turn it on: Atlassian Administration → **Rovo → Rovo MCP server → Authentication** section, toggle **API token** (control-settings doc; README gives the same path). If disabled, API-token clients cannot connect at all and must use OAuth.
- Create a personal API token **with scopes** at `id.atlassian.com/manage-profile/security/api-tokens` (the docs deep-link preselects `appId=mcp` and all scopes). Base64-encode `email:api_token` and send as `Authorization: Basic ...` via a static `headers` block in `mcp.json` pointing at `https://mcp.atlassian.com/v1/mcp`.
- API tokens are **not bound to a `cloudId`** — every call must pass the correct `cloudId` explicitly (enables cross-site use, adds mis-targeting risk).
- API-token auth skips domain-allowlist validation (no redirect URI) and is governed only by org IP allowlists.
- Required for Jira Service Management and Bitbucket Cloud tools; unavailable for Compass tools (OAuth only). Some tools are missing under API-token auth because their scopes cannot be granted to tokens.

## Retrieval surface

Complete GA tool list from the official "Supported tools" page (read 2026-08-12). Tools are grouped into **permission groups**; org admins grant/revoke at group level. Per-tool **input parameter schemas are not published in the docs** — they are only available from the server's `tools/list` response at runtime (flagged: parameters below are the documented fragments only).

Documented cross-cutting parameter facts:
- Every tool call needs a **`cloudId`**; `getAccessibleAtlassianResources` is the "required first call for any tool because every tool call needs a `cloudId`".
- JQL/CQL search tools accept a result-size parameter; Atlassian's own README recommends pinning `maxResults: 10` or `limit: 10` "for ALL Jira JQL and Confluence CQL search operations".
- `addCommentToJiraIssue` updates an existing comment when `commentID` is provided.

### Common / shared platform tools (no permission group; required for operation)

| Tool | Description | Scopes |
|---|---|---|
| `atlassianUserInfo` | Current user's account info (account ID) | `read:me` |
| `getAccessibleAtlassianResources` | List accessible sites/apps incl. `cloudId` values | `read:account`, `read:me` |

### Jira

| Group | Tool | Description | Scopes |
|---|---|---|---|
| read_jira | `getJiraIssue` | Get a Jira issue by ID or key | `read:jira-work` |
| read_jira | `getJiraIssueRemoteIssueLinks` | List remote issue links on an issue | `read:jira-work` |
| read_jira | `getJiraIssueTypeMetaWithFields` | Create-field metadata for project + issue type | `read:jira-work` |
| read_jira | `getJiraProjectIssueTypesMetadata` | List issue types in a project | `read:jira-work` |
| read_jira | `getIssueLinkTypes` | List available issue link types | `read:jira-work` |
| read_jira | `getTransitionsForJiraIssue` | List available workflow transitions | `read:jira-work` |
| read_jira | `getVisibleJiraProjects` | List projects the user can access | `read:jira-work` |
| read_jira | `lookupJiraAccountId` | Find account IDs by name or email | `read:jira-work` |
| write_jira | `addCommentToJiraIssue` | Add a comment (or update when `commentID` given) | `write:jira-work` |
| write_jira | `addWorklogToJiraIssue` | Add a time-tracking worklog | `write:jira-work` |
| write_jira | `createJiraIssue` | Doc text reads "Create a link between two Jira issues." — an apparent copy error on Atlassian's page; the tool name and the Preview docs (`createJiraIssue` = "Create a new Jira issue") indicate issue creation | `write:jira-work` |
| write_jira | `editJiraIssue` | Update fields on an existing issue | `write:jira-work` |
| write_jira | `transitionJiraIssue` | Perform a workflow transition | `write:jira-work` |
| search_jira | `searchJiraIssuesUsingJql` | Search issues with a JQL query | `search:jira-work` |

### Confluence

| Group | Tool | Description | Scopes |
|---|---|---|---|
| read_confluence | `getConfluencePage` | Get a page or live doc by ID | `read:page:confluence` |
| read_confluence | `getConfluencePageDescendants` | List descendant pages under a parent | `read:hierarchical-content:confluence` |
| read_confluence | `getConfluencePageFooterComments` | List footer comments on a page | `read:comment:confluence` |
| read_confluence | `getConfluencePageInlineComments` | List inline comments on a page | `read:comment:confluence` |
| read_confluence | `getConfluenceCommentChildren` | List replies to a comment | `read:comment:confluence` |
| read_confluence | `getConfluenceSpaces` | List spaces | `read:space:confluence` |
| read_confluence | `getPagesInConfluenceSpace` | List pages in a space | `read:page:confluence` |
| write_confluence | `createConfluencePage` | Create a page or live doc | `write:page:confluence` |
| write_confluence | `updateConfluencePage` | Update a page or live doc | `write:page:confluence` |
| write_confluence | `createConfluenceFooterComment` | Create a footer comment/reply | `write:page:confluence` |
| write_confluence | `createConfluenceInlineComment` | Create an inline comment on selected text | `write:page:confluence` |
| search_confluence | `searchConfluenceUsingCql` | Search content using CQL | `search:confluence` |

### Jira Service Management (API token auth only; admin must enable API-token auth)

| Group | Tool | Description | Scopes |
|---|---|---|---|
| read_jsm | `getJsmOpsAlerts` | Get an ops alert by ID/alias or search query | `read:ops-alert:jira-service-management`, `read:ops-config:jira-service-management`, `read:jira-user` |
| read_jsm | `getJsmOpsScheduleInfo` | List on-call schedules / current-next responders | `read:ops-config:jira-service-management`, `read:jira-user` |
| read_jsm | `getJsmOpsTeamInfo` | List ops teams and details | `read:ops-config:jira-service-management`, `read:jira-user` |
| write_jsm | `updateJsmOpsAlert` | Acknowledge/unacknowledge/close/escalate an alert | `read:ops-alert:jira-service-management`, `write:ops-alert:jira-service-management` |

### Bitbucket Cloud (API token **with scopes** only; admin enablement + workspace linked to the org required)

| Group | Tool | Actions | Scopes |
|---|---|---|---|
| read_bitbucket | `bitbucketWorkspace` | `list`, `get` | `read:workspace:bitbucket` |
| read_bitbucket | `bitbucketRepository` | `list`, `get`, `defaultReviewers` | `read:repository:bitbucket` |
| read_bitbucket | `bitbucketUser` | `pullRequests` | `read:pullrequest:bitbucket` |
| read_bitbucket | `bitbucketDeployment` | `list`, `get` | `read:pipeline:bitbucket` |
| read_bitbucket | `bitbucketPullRequest` | `list`, `get`, `comments`, `diff` | `read:pullrequest:bitbucket` |
| read_bitbucket | `bitbucketRepoContent` | `branch.get`, `commit.get`, `files.get` | `read:repository:bitbucket` |
| read_bitbucket | `bitbucketPipeline` | `list`, `get`, `steps`, `step.get`, `step.log` | `read:pipeline:bitbucket` |
| read_bitbucket | `bitbucketEnvironment` | `list`, `get` | `read:pipeline:bitbucket` |
| write_bitbucket | `bitbucketPullRequest` | `create`, `merge`, `approve`, `comment` | `write:pullrequest:bitbucket` |
| write_bitbucket | `bitbucketRepoContent` | `branch.create`, `commit.create` | `write:repository:bitbucket` |
| write_bitbucket | `bitbucketPipeline` | `run` | `write:pipeline:bitbucket` |
| write_bitbucket | `bitbucketEnvironment` | `create`, `delete`, `update` | `admin:pipeline:bitbucket` |

Bitbucket tools are multiplexed: one tool name with an `Actions` discriminator rather than one tool per verb.

### Compass (OAuth 2.1 only)

| Group | Tool | Description | Scopes |
|---|---|---|---|
| read_compass | `getCompassComponent` | Component by ID | `read:component:compass` |
| read_compass | `getCompassComponents` | Search/list components | `read:component:compass` |
| read_compass | `getCompassComponentActivityEvents` | Recent activity events | `read:component:compass` |
| read_compass | `getCompassComponentLabels` | Labels on a component | `read:component:compass` |
| read_compass | `getCompassComponentTypes` | List component types | `read:component:compass` |
| read_compass | `getCompassCustomFieldDefinitions` | List custom field definitions | `read:component:compass` |
| read_compass | `getCompassComponentsOwnedByMyTeams` | Components owned by your teams | `read:component:compass` |
| write_compass | `createCompassComponent` | Create a component | `write:component:compass` |
| write_compass | `createCompassComponentRelationship` | Relate two components | `write:component:compass` |
| write_compass | `createCompassCustomFieldDefinition` | Create a custom field definition | `write:component:compass` |

### Atlassian platform (Rovo search + Teamwork Graph)

| Group | Tool | Description | Scopes |
|---|---|---|---|
| search_atlassian | `searchAtlassian` (beta) | Natural-language search across Jira and Confluence via Rovo | `search:rovo:mcp` |
| search_atlassian | `fetchAtlassian` (beta) | Fetch Jira/Confluence content by Atlassian Resource Identifier (ARI) | `search:rovo:mcp` |
| read_teamwork_graph | `getTeamworkGraphContext` (beta) | Connected context (all relationships/linked objects) for any Atlassian entity, incl. cross-product and third-party links | 12 scopes incl. `read:jira-work`, `read:page:confluence`, `read:3p-data:mcp`, `read:loom:mcp` |
| read_teamwork_graph | `getTeamworkGraphObject` (beta) | Full data for one or more objects by ARI or URL | same scope list |
| read_teamwork_graph | `addTeamworkGraphContext` | Add a relationship between two objects | `write:all:twg` |

Teamwork Graph tools can pull third-party data (GitHub, GitLab, Azure DevOps, Jenkins, Spinnaker connectors); GitHub retrieval depends on the connector's Full vs Limited access mode. Billing note: when TWG tools reach GA they will be billed at a minimum of 1 Rovo credit per call, with at least 90 days' notice; Beta tools are currently free.

### MCP v2 Preview endpoint (`/v1/mcp/preview`, docs last updated Jun 30, 2026)

Different surface: a small pre-declared set (`getAccessibleAtlassianResources`, `atlassianUserInfo`, `getToolDescription`, `getConfluenceContent`, `createConfluenceContent`, `updateConfluenceContent`, `searchConfluence`, `getJiraIssue`, `searchJiraIssuesUsingJql`, `createJiraIssue`, `editJiraIssue`, `transitionJiraIssue`, `getLoomVideo`, TWG tools) plus a large catalog of operations behind `discover` (find operations by describing intent) and `execute` (run an operation by name) — including Confluence attachments/whiteboards/databases/folders/export, Jira attachments/versions/worklogs, and Loom operations. Attachment/whiteboard tools need extra domains allowlisted: `api.media.atlassian.com` and `*.frontend.public.atl-paas.net`. Do not build a deterministic scheduler against Preview: "tools and their responses may change".

## Pagination

**No pagination mechanics are documented anywhere in the Rovo MCP docs** (checked: getting started, supported tools, auth pages, troubleshooting, developer portal, README). What is verified:

- Search tools take a result-size parameter (`maxResults` for Jira JQL, `limit` for Confluence CQL — parameter names appear in Atlassian's own README recommendation "use `maxResults: 10` or `limit: 10`").
- Preview docs describe `searchJiraIssuesUsingJql` as "Search for Jira issues using JQL with optional count".
- Whether tools return cursors/`startAt`/`nextPageToken` is (unverified) — discover the actual schema from the server's `tools/list` response at runtime and treat it as authoritative.

Deterministic pattern in the absence of documented cursors: order results explicitly in JQL/CQL (`ORDER BY key ASC`, `ORDER BY created ASC`) and window by a sortable field predicate (e.g. `key > "PROJ-123"`, `created >= "2026-01-01"`) rather than relying on undocumented offsets.

## Rate limits

Published numbers (Atlassian FAQ on the official product page, read 2026-08-12 — the support-docs collection itself publishes **no** numbers):

| Plan (Jira/Confluence) | Site-level limit |
|---|---|
| Free | 500 calls per hour |
| Standard | 1,000 calls per hour |
| Premium/Enterprise | 1,000 calls per hour + 20 additional calls per user, up to 10,000 calls per hour |

Exact FAQ wording: "there are site-level rate limits depending on what Jira and Confluence plan you're on. Free: 500 calls per hour; Standard: 1000 calls per hour; Premium/Enterprise: 1000 calls per hour (+ 20 additional calls per user with up to 10,000 calls per hour)".

- **Scope:** site-level (per Atlassian Cloud site), not per token. Per-user vs per-org sub-accounting beyond the "+20 per user" formula is (unverified).
- **Error semantics:** Atlassian documents no error format for the MCP endpoint. Secondary source (bug report on the official repo, issue #171, May 2026, acknowledged by an Atlassian collaborator but unanswered as of 2026-08-12): over-limit calls return **HTTP `429 Too Many Requests`** with a **`Retry-After` header (seconds)** and **no** `x-ratelimit-limit` / `x-ratelimit-remaining` / `x-ratelimit-interval-seconds` / `x-ratelimit-fillrate` headers (the header names Atlassian's REST rate-limiting docs describe). The same report observed 429s triggered by **~20 parallel calls** despite total volume far below 1,000/hour, suggesting an additional concurrency/burst throttle (unverified by Atlassian).
- **403 vs 429:** not documented for this service. Permission failures surface as tool-level "Access denied" errors tied to product permissions; IP-allowlist blocks return the message "You don't have permission to connect from this IP address. Please ask your admin for access."
- **Observing remaining budget:** there is **no documented or observed way** to query remaining budget. The only cheap strategy is client-side call counting against the plan number plus honoring `Retry-After` on 429.
- **Cost/credits (distinct from rate limits):** Beta-marked tools are free today; Teamwork Graph tools will bill at ≥1 Rovo credit per call at GA with ≥90 days' notice.

## Deterministic retrieval recipes

The server speaks MCP, not plain REST — `curl` alone cannot complete the OAuth flow, but with API-token auth (admin-enabled) the HTTP endpoint accepts standard MCP JSON-RPC POSTs. Recipes below were composed from documented constants; the JSON-RPC envelope is standard MCP (the envelope itself is not shown in Atlassian docs — validate the initialize handshake against the MCP spec at runtime).

Claude Code (OAuth, interactive first run):

```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2
# then inside a session: /mcp   -> completes browser auth
```

Generic stdio client via mcp-remote (OAuth; tokens land in ~/.mcp-auth):

```json
{ "mcpServers": { "atlassian": {
    "command": "npx",
    "args": ["-y", "mcp-remote@latest", "https://mcp.atlassian.com/v1/mcp/authv2"]
} } }
```

Headless mcp.json with a personal API token (admin must have enabled API-token auth):

```json
{ "mcpServers": { "atlassian-rovo-mcp": {
    "url": "https://mcp.atlassian.com/v1/mcp",
    "headers": { "Authorization": "Basic $(echo -n 'you@example.com:API_TOKEN' | base64)" }
} } }
```

Minimal deterministic call sequence (tool names and parameter fragments per docs; full schemas from `tools/list`):

1. `getAccessibleAtlassianResources` → capture `cloudId` (required by every subsequent call). Cache it; Atlassian's own guidance is to pin `cloudId` in agent config to avoid repeating this discovery call.
2. `searchJiraIssuesUsingJql` with `{ "cloudId": "...", "jql": "project = PROJ AND updated >= -1d ORDER BY key ASC", "maxResults": 10 }`.
3. `getJiraIssue` with `{ "cloudId": "...", <issue key or ID> }` for point reads.
4. `searchConfluenceUsingCql` with `{ "cloudId": "...", "cql": "space = DOCS AND type = page ORDER BY created ASC", "limit": 10 }`, then `getConfluencePage` by ID.

Pin defaults (from Atlassian's README "Tips and tricks", verbatim pattern for AGENTS.md):

```md
## Atlassian Rovo MCP
When connected to atlassian-rovo-mcp:
- **MUST** use Jira project key = YOURPROJ
- **MUST** use Confluence spaceId = "123456"
- **MUST** use cloudId = "https://yoursite.atlassian.net" (do NOT call getAccessibleAtlassianResources)
- **MUST** use `maxResults: 10` or `limit: 10` for ALL Jira JQL and Confluence CQL search operations.
```

Debugging the bridge:

```bash
npx -y mcp-remote@latest https://mcp.atlassian.com/v1/mcp/authv2 --debug   # logs to ~/.mcp-auth/{server_hash}_debug.log
rm -rf ~/.mcp-auth                                                          # nuke cached OAuth state
```

## Scheduler implications

Hard constraints a rate-limit-aware parallel scheduler must respect for this backend:

- **Hourly site budget:** 500 (Free) / 1,000 (Standard) / 1,000 + 20×users capped at 10,000 (Premium/Enterprise) calls per hour, **shared across every user and client on the site** — the scheduler's budget is global per site, not per worker.
- **Count client-side.** No budget/remaining headers exist; maintain a local counter per site per rolling hour and stop dispatching before the cap.
- **Low concurrency cap.** Community evidence (official-repo issue #171, Atlassian-unconfirmed) shows 429s at ~20 parallel calls independent of hourly volume. Keep parallelism well below that (single-digit worker pool) until Atlassian documents a burst limit.
- **On 429: honor `Retry-After` (seconds) exactly**; it is the only throttle signal on the wire. Pause the whole site bucket, not just the failing worker.
- **One discovery call, then cache:** call `getAccessibleAtlassianResources` once and pin `cloudId`; every avoided rediscovery call is budget saved.
- **Bucket by site (`cloudId`).** Limits are site-level; multi-site schedulers need one budget/queue per `cloudId`. With API-token auth, tokens are cross-site, so a wrong `cloudId` is a silent cross-site query, not an error — validate `cloudId` on every job.
- **Endpoint pinning:** use `https://mcp.atlassian.com/v1/mcp/authv2`; never `/v1/sse` (unsupported after 2026-06-30); never `/v1/mcp/preview` for production (tools/responses may change).
- **OAuth state must not be cached across the DCR boundary:** do not persist `client_id` or the discovery document independently of the token store; a stale cache fails auth (post-May-27-2026 server).
- **Expect silent auth expiry:** expired tokens produce empty/failed tool results rather than clean 401s ("If your token expires, your session will silently fail") — treat empty-result anomalies as an auth-health probe trigger, re-run the mcp-remote flow or refresh the token.
- **Bound result sizes:** always pass `maxResults`/`limit` (Atlassian recommends 10) — unbounded searches burn budget and context.
- **Cost guard for TWG tools:** gate `getTeamworkGraphContext`/`getTeamworkGraphObject` behind a feature flag; they are slated for per-call Rovo-credit billing at GA (≥1 credit/call, 90-day notice).
- **Admin preconditions are hard dependencies:** API-token auth toggled on (for headless/JSM/Bitbucket), Bitbucket workspace linked to the org, first-user 3LO consent completed, domain and IP allowlists configured. A scheduler cannot self-heal these; surface them as operator actions.

## Failure modes and healing signals

| Failure | On the wire | Healing action |
|---|---|---|
| Rate limited | HTTP `429 Too Many Requests`, `Retry-After: <seconds>` header, no x-ratelimit-* headers (secondary source: official-repo issue #171) | Sleep exactly `Retry-After`, halve concurrency for the site bucket, resume; persistently bursty 429s ⇒ serialize |
| IP allowlist block | Tool call fails with "You don't have permission to connect from this IP address. Please ask your admin for access." (OAuth consent screen may still appear before calls fail) | Not self-healable: operator must add the egress IP/VPN range to the org IP allowlist; note some AI tools use their own outbound IPs |
| Expired/invalid OAuth token | Silent failure: no data or empty/partial results, no clean error ("your session will silently fail") | Re-run `npx mcp-remote` (or the client's auth flow); if stuck, `rm -rf ~/.mcp-auth` and re-auth; verify granted scopes |
| Stale DCR cache (post-May-27-2026) | Auth flow fails; old `client_id`/discovery doc "will not be recognised by the new server" | Purge cached OAuth metadata (`~/.mcp-auth` for mcp-remote), re-register via `/v1/mcp/authv2` |
| OAuth loop / redirect error | Browser pop-up blocked or the derived callback port blocked (39570 for the authv2 endpoint; Atlassian's docs wrongly say 3334) | Allow pop-ups and the derived callback port — pin it with a positional port argument for a stable firewall allowlist entry; retry |
| App not authorized on site | "Your site admin must authorize this app" error during 3LO | Operator: a site admin must complete the 3LO consent once (JIT install); afterwards other users can connect |
| API-token auth disabled by admin | Client cannot connect at all with Basic/Bearer token headers | Switch to OAuth 2.1, or operator enables API token in Atlassian Administration → Rovo → Rovo MCP server → Authentication |
| Insufficient product permissions | "Access denied" errors / empty results scoped to the user's Jira/Confluence permissions | Not self-healable: verify product access in Atlassian Administration; the server never exceeds user permissions |
| Missing scopes on API token | Tools absent from `tools/list` or calls fail; some tools (e.g. Compass) can never work with tokens | Regenerate token with required scopes; for Compass/Loom tools switch to OAuth |
| Wrong `cloudId` (API-token auth) | No error — queries hit the wrong site (tokens are unbounded) | Assert expected site in results (e.g. issue key prefix, space key) before trusting output |
| SSE endpoint used | (unverified exact response) — endpoint unsupported after 2026-06-30 | Repoint config to `https://mcp.atlassian.com/v1/mcp/authv2` |
| Domain blocked by org (OAuth clients) | Connection blocked for tools from non-allowed domains; separately, if network egress filtering blocks `*.atlassian.net`, widget iframes fail to load and the server "may appear to be 'down' or 'not functioning'" | Operator: adjust Rovo MCP server domain settings in Atlassian Administration; allowlist `*.atlassian.net` in egress filtering |

Audit trail: every tool invocation is recorded in the org audit log (Atlassian Administration → Insights → Audit log, filter "Rovo MCP User Actions") — useful for reconciling client-side call counts against actual usage.

## Sources

All accessed 2026-08-12. Cached copies in `.web-docs/` as noted.

| URL | Grounded | Cache |
|---|---|---|
| https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/ | Name, supported clients, endpoint URLs, per-client setup commands (Claude Code/Codex/VS Code/Cursor/Windsurf), OAuth 2.1 statement | `undefined-rovo-mcp-getting-started.md` |
| https://support.atlassian.com/rovo/docs/getting-started-with-the-atlassian-remote-mcp-server/ | Same content served at legacy path (still live) | — |
| https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/ | Complete GA tool list, permission groups, scopes, JSM/Bitbucket/Compass auth restrictions, Rovo-credit notes | `undefined-rovo-mcp-supported-tools.md` |
| https://support.atlassian.com/atlassian-rovo-mcp-server/docs/authentication-and-authorization/ | Auth methods table, exact Authorization header formats | `undefined-rovo-mcp-auth-and-authz.md` |
| https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-oauth-2-1/ | Bearer flow, cloudId binding, SSE deprecation banner (30 June 2026), common auth issues | `undefined-rovo-mcp-configuring-oauth21.md` |
| https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/ | Basic/Bearer configs, token-creation URL, API-token limitations (no bounded cloudId, no domain allowlist) | `undefined-rovo-mcp-configuring-api-token.md` |
| https://support.atlassian.com/atlassian-rovo-mcp-server/docs/troubleshooting-and-verifying-your-setup/ | localhost:3334 allowlist (contradicted by mcp-remote 0.1.38 source — see Authentication above), silent token expiry, symptom/cause/fix table | `undefined-rovo-mcp-troubleshooting.md` |
| https://support.atlassian.com/atlassian-rovo-mcp-server/docs/setting-up-ides/ | mcp-remote invocation (`npx -y mcp-remote@latest ...`), Node.js v18+ requirement | `undefined-rovo-mcp-setting-up-ides.md` |
| https://support.atlassian.com/security-and-access-policies/docs/understand-atlassian-rovo-mcp-server/ | Domain settings, IP allowlisting behavior + exact block message, admin model | `undefined-rovo-mcp-understand-admin.md` |
| https://support.atlassian.com/security-and-access-policies/docs/control-atlassian-rovo-mcp-server-settings/ | API-token toggle path, domain add/block/delete, `*.atlassian.net` warning | `undefined-rovo-mcp-control-settings.md` |
| https://www.atlassian.com/platform/remote-mcp-server | GA status, rate-limit numbers (500/1000/10,000 per hour), no FedRAMP/HIPAA, no-store proxy statement | `undefined-rovo-mcp-platform-faq.md` |
| https://github.com/atlassian/atlassian-mcp-server (README) | GA badge, endpoint recommendations, product/auth matrix, JIT install, audit log path, maxResults/limit tip, admin troubleshooting strings | `undefined-rovo-mcp-github-readme.md` |
| https://developer.atlassian.com/cloud/rovo-mcp/ | Developer-portal docs hub existence and structure | `undefined-rovo-mcp-devportal-overview.md` |
| https://developer.atlassian.com/cloud/rovo-mcp/changelog/ | v2 Preview announcement (1 Jul 2026), DCR OAuth migration (27 Apr → effective 27 May 2026), discovery-doc URL, no-caching requirement | `undefined-rovo-mcp-devportal-changelog.md` |
| https://developer.atlassian.com/cloud/rovo-mcp/preview/index/ | Preview endpoint URL, discover/execute model, extra media domains | `undefined-rovo-mcp-preview-index.md` |
| https://developer.atlassian.com/cloud/rovo-mcp/preview/tools/ | Preview pre-declared tools + discovery operations catalog | `undefined-rovo-mcp-preview-tools.md` |
| https://github.com/geelen/mcp-remote (README) | ~/.mcp-auth storage, MCP_REMOTE_CONFIG_DIR, --debug/--host/--transport flags; its "default port 3334" claim is contradicted by the shipped 0.1.38 code (see Authentication above) | `undefined-mcp-remote-readme.md` |
| https://github.com/atlassian/atlassian-mcp-server/issues/171 | **Secondary/community source:** 429 + Retry-After-only wire behavior, no x-ratelimit-* headers, concurrency-triggered throttling (~20 parallel), Atlassian collaborator ack 2026-05-31, unresolved | `undefined-rovo-mcp-gh-issue-171.md` |
| https://support.atlassian.com/atlassian-rovo-mcp-server/ | Returns HTTP 404 (collection root has no page) | — |
