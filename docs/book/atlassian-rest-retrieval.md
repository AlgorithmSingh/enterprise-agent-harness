---
type: reference
title: "Jira & Confluence Cloud REST Retrieval and Rate Limiting"
description: "Verified endpoint surface, pagination mechanics, auth, and the points/burst rate-limit model for direct REST retrieval from Jira Cloud (v3) and Confluence Cloud (v2), with scheduler constraints and curl recipes."
timestamp: "2026-08-12"
---

# Jira & Confluence Cloud REST Retrieval and Rate Limiting

All constants below were verified against pages fetched on 2026-08-12. Both Atlassian rate-limiting docs displayed "Last updated Aug 12, 2026" at access time. Jira reference is REST API v3; Confluence references are REST API v2 (`/wiki/api/v2`) and v1 (`/wiki/rest/api/search` for CQL). Anything not verified in a fetched source is flagged "(unverified)".

## 1. Overview

Direct REST calls to Jira Cloud and Confluence Cloud are the deterministic fallback / high-throughput retrieval path in this harness: no MCP session, no LLM tool-call ambiguity — plain HTTPS + Basic auth, fully scriptable and replayable. Two facts shape the whole design:

- **Jira issue search migrated in 2024–2025.** The classic `GET/POST /rest/api/3/search` (and `/rest/api/2/search`) endpoints are marked `deprecated` with summary "Currently being removed" in the current v3 reference (changelog CHANGE-2046); live tenants return **410 Gone** for them (secondary sources, below). The replacement is `GET/POST /rest/api/3/search/jql` ("enhanced search") with `nextPageToken` cursor pagination, mandatory *bounded* JQL, and a `fields` default of `id` (minimal payloads by default). There is no `total` in the new response; counting is a separate `approximate-count` endpoint.
- **Rate limiting is a three-part system** (points-based hourly quotas, per-second per-endpoint burst buckets, per-issue write limits). The points-based quotas (enforced from March 2, 2026) apply to Forge/Connect/OAuth 2.0 apps; per the docs, "API token-based traffic is not affected by this change, and will continue to be governed by existing burst rate limits" — which makes API-token Basic auth the predictable budget for this pipeline. Separately, Atlassian announced API-token-specific rate limits starting November 22, 2025 (numbers not published in the announcement).

## 2. Authentication

### API token + Basic auth (primary for this pipeline)

- Create an API token from your Atlassian account settings (id.atlassian.com API tokens page; the Basic-auth doc links "Atlassian Account settings" → API tokens). Password Basic auth is deprecated; tokens are required.
- Token lifetime: chosen at creation, **1 day to 1 year**. Since **December 15, 2024** new tokens default to 1-year expiry; since **March 13, 2025** older tokens were also set to expire. Plan rotation.
- Header: `Authorization: Basic base64("<email>:<api_token>")`, or simply curl `-u "$EMAIL:$TOKEN"`.

Harness environment-variable convention (ours, not Atlassian's):

```bash
export ATLASSIAN_SITE="your-domain.atlassian.net"   # tenant host
export ATLASSIAN_EMAIL="bot@example.com"            # account email
export ATLASSIAN_API_TOKEN="..."                    # API token (secret)
AUTH=(-u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN")
```

Base URLs: Jira `https://$ATLASSIAN_SITE`, Confluence `https://$ATLASSIAN_SITE/wiki` (v2 spec server is literally `https://{your-domain}/wiki/api/v2`).

### OAuth 2.0 (3LO) / app auth (alternative)

- Confluence v2 intro: apps authenticate with JWT or OAuth 2.0; direct calls use Basic auth. Authorization is scopes (apps) or the calling user's permissions (direct).
- Scopes verified from the references: Jira enhanced search — classic scope `read:jira-work` (recommended), granular `read:issue-details:jira` (plus `read:audit-log:jira`, `read:avatar:jira`, `read:field-configuration:jira`, `read:issue-meta:jira`); Connect scope `READ`. Confluence `GET /pages` — `read:page:confluence`.
- Consequence: OAuth-app traffic falls under the points-based hourly quotas (Section 5); API-token traffic does not (burst limits only). 3LO requests are routed via Atlassian's API gateway with a cloudId-based base URL (unverified in this pass — confirm before hardcoding).

Failed-auth lockout: repeated failed Basic-auth attempts trigger a CAPTCHA, after which REST authentication is denied until the CAPTCHA is cleared in a browser.

## 3. Retrieval surface

### Jira Cloud REST v3 (base `https://<site>.atlassian.net`)

| Method & path | Purpose | Minimal-payload parameters | Verified limits/notes |
|---|---|---|---|
| `GET /rest/api/3/search/jql` | Enhanced JQL search (current) | `jql` (**bounded** query required; `orderBy` ≤ 7 fields), `fields` (**default `id`** — IDs only), `maxResults` (default 50), `nextPageToken`, `expand`, `properties` (≤ 5), `fieldsByKeys`, `failFast`, `reconcileIssues` (≤ 50 ids, for read-after-write consistency) | Page size may be trimmed when many fields requested; "It returns max 5000 issues" per page when requesting `id` or `key` only. Responses: 200/400/401 |
| `POST /rest/api/3/search/jql` | Same, JQL in JSON body | body: `jql`, `fields`, `maxResults`, `nextPageToken`, `expand`, `properties`, `fieldsByKeys`, `reconcileIssues` | Use when JQL too large for a query string |
| `POST /rest/api/3/search/approximate-count` | Estimated count for a JQL | body `{"jql": "..."}` → `{"count": <int64>}` | Requires bounded JQL; "recent updates might not be immediately visible" |
| `GET /rest/api/3/issue/{issueIdOrKey}` | Single issue | `fields` (comma-separated; `*all`, `*navigable`, field names, `-field` to exclude; **default: all fields** — always pass `fields`), `expand` (`renderedFields,names,schema,transitions,operations,editmeta,changelog,versionedRepresentations`), `properties`, `fieldsByKeys`, `failFast` | `expand=changelog` returns recent changelogs only (bulk-fetch doc: max 40) |
| `POST /rest/api/3/issue/bulkfetch` | Hydrate up to **100** issues in one call | body: `issueIdsOrKeys` (required), `fields`, `expand`, `properties`, `fieldsByKeys` | Returned in ascending `id` order; unmatched ids reported as errors, no 302 redirects |
| `GET /rest/api/3/issue/{issueIdOrKey}/changelog` | Full changelog of one issue | `startAt` (default 0), `maxResults` (default 100) | Offset pagination (not cursor) |
| `POST /rest/api/3/changelog/bulkfetch` | Changelogs for up to **1000** issues | body: `issueIdsOrKeys` (1–1000, required), `fieldIds` (≤ 10), `maxResults` (default 1000, max 10000), `nextPageToken` | Sorted oldest-first by changelog date then issue ID; cursor pagination |
| `GET /rest/api/3/search`, `POST /rest/api/3/search` | **Deprecated — being removed** (CHANGE-2046) | (`jql`, `startAt`, `maxResults`, `validateQuery`, `fields`, `expand`…) | Do not use; live tenants return 410 Gone (secondary sources) |

### Confluence Cloud REST v2 (base `https://<site>.atlassian.net/wiki/api/v2`)

| Method & path | Purpose | Minimal-payload parameters | Verified limits/notes |
|---|---|---|---|
| `GET /wiki/api/v2/pages` | List/filter pages | `id` (csv of page ids), `space-id` (csv), `status` (default `current,archived`), `title`, `subtype` (`live`\|`page`), `body-format`, `sort`, `cursor`, `limit` (default 25, min 1, **max 250**) | Omit `body-format` for metadata-only listings (body content not needed for enumeration; whether the body field is then empty is unverified) |
| `GET /wiki/api/v2/pages/{id}` | Single page | `body-format`, `version` (fetch a prior published version), `get-draft` (default false), `include-*` flags (labels/properties/operations/likes/versions/collaborators/webresources/direct-children — all default false; `include-version` default true) | `include-*` sublists capped at 50 entries |
| `GET /wiki/api/v2/spaces` | List spaces | `ids`, `keys` (csv), `type` (`global`,`collaboration`,`knowledge_base`,`personal`,…), `status` (`current`\|`archived`), `labels`, `description-format`, `cursor`, `limit` (default 25, min 1, **max 250**) | |
| `GET /wiki/api/v2/spaces/{id}` | Single space | `description-format`, `include-icon` (default false), `include-*` (default false) | |
| `GET /wiki/rest/api/search` (v1) | **CQL search** | `cql` (required), `cqlcontext` (`spaceKey`/`contentId`/`contentStatuses`), `cursor`, `limit` (default 25; "may be restricted by fixed system limits"), `start` (default 0), `excerpt` (default `highlight`), `expand`, `includeArchivedSpaces` | CQL no longer supports user-specific fields (`user`, `user.fullname`, `user.accountid`, `user.userkey`) |

`body-format` values (v2): multi-result fetches accept `storage`, `atlas_doc_format`; single-item fetches additionally accept `view`, `export_view`, `anonymous_export_view`, `styled_view`, `editor`.

## 4. Pagination

| Surface | Mechanism | Exact behavior |
|---|---|---|
| Jira `search/jql` | `nextPageToken` cursor | First page: no token (`null`). Each 200 response carries `nextPageToken` **unless it is the last page, where the field is absent/null**; `isLast: boolean` also present. Pass the token back verbatim with the same `jql`/`fields`. **Tokens expire in 7 days** (response schema: "This token will expire in 7 days."). No `total`, no `startAt` — use `approximate-count` for counts. |
| Jira `changelog/bulkfetch` | `nextPageToken` cursor | Same cursor pattern; `maxResults` 1–10000 (default 1000). |
| Jira per-issue `/changelog` | Offset | `startAt` + `maxResults` (default 100) classic offset paging. |
| Confluence v2 (`/pages`, `/spaces`, …) | Opaque `cursor` + `Link` header | Response header `Link: </wiki/api/v2/pages?limit=5&cursor=<token>>; rel="next"` (relative URL; prepend `https://<site>`). Body `_links.next` mirrors it. **Absence of the `Link` header / `_links.next` = last page.** `limit` 1–250, default 25. |
| Confluence v1 CQL search | `cursor` inside `_links.next` / `_links.prev` | Follow `_links.next` (e.g. `/rest/api/search?cql=...&limit=25&cursor=raNDoMsT...`); `start`/`limit` offset params also exist (legacy). |

## 5. Rate limits

Three independent systems are enforced simultaneously (Jira doc; Confluence doc describes points quota + burst). All three return **429 Too Many Requests** when exceeded.

### Published limits

| Limit | Scope | Exact value | Applies to |
|---|---|---|---|
| Points quota, Tier 1 "Global Pool" (default) | per app, shared across **all** tenants, per hour | **65,000 points/hour**, resets at the top of each UTC hour | Forge, Connect, OAuth 2.0 (3LO) apps; enforcement began **March 2, 2026**. **Not** API-token traffic |
| Points quota, Tier 2 "Per-Tenant Pool" (after Atlassian review only) | per app, per tenant, per hour | Free **65,000**; Standard **100,000 + 10 × users**; Premium **130,000 + 20 × users**; Enterprise **150,000 + 30 × users**; capped at **500,000**/hour (Std/Prem/Ent) | Same as above |
| Point costs | per request | **1 base point** + **1 point** per core-domain object read (Issues, Projects, Dashboards / Pages, Spaces, Attachments) + **2 points** per identity object read (Users, Groups, Permissions); writes (POST/PUT/PATCH/DELETE) = **1 point** flat; uncategorized = 1 point | REST and GraphQL alike |
| Burst limits (token bucket) | per **tenant × endpoint × HTTP method**, per second | Default steady-state: **GET 100 rps, POST 100 rps, PUT 50 rps, DELETE 50 rps**. Custom overrides include (URIs as printed in the doc): `GET /api/{version}/issue/{issueidorkey}` **150**; `GET /api/{version}/issue/{issueidorkey}/changelog` **200**; `POST /api/{version}/search/approximate-count` **150**; `GET /api/{version}/user` **150**; `GET /api/user/email` **200**; `GET /api/{version}/attachment/content/{id}` **300**; `GET /api/content/{id}/state` **400** | All traffic, including API-token Basic auth |
| Burst buffer illustration | — | Doc example: bucket size 100 tokens, refill 10 tokens/second → after draining, sustain 10 rps indefinitely; full refill of a drained bucket takes 10 s | "Design your app around the steady-state refill rate, not the burst buffer" |
| Per-issue write limits | per single issue | **20 write ops / 2 s** (short window) and **100 write ops / 30 s** (long window) | All write traffic |
| API-token limits | per API token traffic | Effective **November 22, 2025**; announcement published **no numbers** ("actively refining these limits") — current docs state API-token traffic is governed by the existing burst limits | Scripts/integrations on API tokens |

### Response headers (exact names)

| Header | When | Meaning |
|---|---|---|
| `X-RateLimit-Limit` | normal + 429 | Max request rate for the current scope (for request-rate limits: allowed requests **per second**) |
| `X-RateLimit-Remaining` | normal + 429 | Remaining capacity in the current window (for request-rate limits: remaining requests this second) |
| `X-RateLimit-Reset` | Jira: **429 only**; Confluence table does not restrict | ISO 8601 timestamp when the current window resets |
| `X-RateLimit-NearLimit` | normal | `true` when **< 20 %** of capacity remains (quota limits; "not used for request rate limiting") |
| `RateLimit-Reason` | **429 only** | Which limit tripped: Jira `jira-quota-global-based`, `jira-quota-tenant-based`, `jira-burst-based`, `jira-per-issue-on-write`; Confluence `confluence-quota-global-based`, `confluence-quota-tenant-based` |
| `Retry-After` | **429 only** (also on some transient 5xx/503) | Seconds to wait before retrying |
| `Beta-RateLimit-Policy` | normal (points quota, structured) | `"<policy>";q=<total quota>;w=<window seconds>` — policies `global-app-quota`, `tenant-app-quota`, (Jira also `jira-burst-based`). Example: `Beta-RateLimit-Policy: "global-app-quota";q=65000;w=3600` |
| `Beta-RateLimit` | normal | `"<policy>";r=<remaining>;t=<seconds until reset>`; **`r` appears only once usage exceeds ~80 % of quota** — absence of `r` means you are well within limits |
| `Beta-Retry-After` | would-be-throttled responses | Seconds you would have had to wait were enforcement active; at enforcement the `Beta-` prefix is dropped (`RateLimit-Policy`, `RateLimit`, `Retry-After`) |
| `X-Beta-RateLimit-Limit` / `-Remaining` / `-Reset` / `-NearLimit` / `-Reason` | legacy beta set | Same semantics as the `X-RateLimit-*` set, for limits not yet enforced (also the announced header set for API-token limits) |

### Status-code semantics

- **429** — the only rate-limit status in current docs. Read `RateLimit-Reason` to pick the recovery action (Section 7). Quota exhaustion means **all requests are denied until the next UTC-hour reset — "no partial throttling"**.
- **403** — *not* a rate-limit signal in current docs; it indicates permission problems (and the CAPTCHA lockout after repeated failed logins denies REST auth — exact status unverified). Note Jira search silently *omits* issues you lack "Browse projects"/issue-level-security permission for, rather than returning 403.
- **410 Gone** — permanent removal (classic `/rest/api/{2,3}/search`); migrate, never retry (secondary sources: Strategy KB489535, atlassian-mcp-server issue #70, AWS re:Post).
- **503/5xx with `Retry-After`** — transient, not rate limiting; docs say to apply the same retry logic.
- **401** — bad/expired credentials (tokens now expire ≤ 1 year).

### Observing remaining budget cheaply

Read headers on responses you are already making — zero extra cost: watch `X-RateLimit-NearLimit: true` (< 20 % left), `X-RateLimit-Remaining`, and parse `Beta-RateLimit` (the moment `r=` appears you are past ~80 % of the hourly quota). Do not build header-probing loops: any probe costs ≥ 1 point on app traffic, and Atlassian's AUP forbids rate-limit testing against cloud tenants.

## 6. Deterministic retrieval recipes

All recipes assume the env vars from Section 2 and `jq`. Add `-sS --fail-with-body` for scripting.

**Enumerate issue IDs (cheapest possible enumeration — `fields` defaults to `id`, up to 5000/page):**

```bash
curl -sS "${AUTH[@]}" -H "Accept: application/json" --get \
  "https://$ATLASSIAN_SITE/rest/api/3/search/jql" \
  --data-urlencode 'jql=project = ABC AND updated >= -7d ORDER BY key' \
  --data-urlencode 'maxResults=5000' \
| jq -r '.issues[].id'
```

**Full cursor loop (resumable; token valid 7 days):**

```bash
TOKEN=""
while :; do
  RESP=$(curl -sS "${AUTH[@]}" --get "https://$ATLASSIAN_SITE/rest/api/3/search/jql" \
    --data-urlencode 'jql=project = ABC ORDER BY key' \
    --data-urlencode 'fields=key,summary,status,updated' \
    --data-urlencode 'maxResults=100' \
    ${TOKEN:+--data-urlencode "nextPageToken=$TOKEN"})
  jq -c '.issues[]' <<<"$RESP"
  TOKEN=$(jq -r '.nextPageToken // empty' <<<"$RESP")
  [ -z "$TOKEN" ] && break            # nextPageToken absent => last page
done
```

**Approximate result count (replaces the removed `total`):**

```bash
curl -sS "${AUTH[@]}" -X POST -H "Content-Type: application/json" \
  "https://$ATLASSIAN_SITE/rest/api/3/search/approximate-count" \
  -d '{"jql":"project = ABC AND statusCategory != Done"}' | jq .count
```

**Single issue, minimal fields:**

```bash
curl -sS "${AUTH[@]}" \
  "https://$ATLASSIAN_SITE/rest/api/3/issue/ABC-123?fields=summary,status,assignee,updated" \
| jq '{key, fields}'
```

**Hydrate 100 enumerated issues per call:**

```bash
jq -n --argjson keys "$(jq -Rn '[inputs]' < ids.txt)" \
  '{issueIdsOrKeys: $keys, fields: ["key","summary","status","updated"]}' \
| curl -sS "${AUTH[@]}" -X POST -H "Content-Type: application/json" \
    "https://$ATLASSIAN_SITE/rest/api/3/issue/bulkfetch" -d @- \
| jq -c '.issues[]'
```

**Bulk changelogs (up to 1000 issues, filter to ≤ 10 fields):**

```bash
curl -sS "${AUTH[@]}" -X POST -H "Content-Type: application/json" \
  "https://$ATLASSIAN_SITE/rest/api/3/changelog/bulkfetch" \
  -d '{"issueIdsOrKeys":["ABC-1","ABC-2"],"fieldIds":["status"],"maxResults":1000}' \
| jq -c '.issueChangeLogs[]?'   # field name verified in the v3 spec (BulkChangelogResponseBean.issueChangeLogs)
```

**Confluence: list pages in a space (metadata only), follow Link-header cursor:**

```bash
URL="https://$ATLASSIAN_SITE/wiki/api/v2/pages?space-id=123456&status=current&limit=250"
while [ -n "$URL" ]; do
  RESP=$(curl -sS "${AUTH[@]}" "$URL")
  jq -c '.results[] | {id, title, status, version: .version.number}' <<<"$RESP"
  NEXT=$(jq -r '._links.next // empty' <<<"$RESP")
  URL=${NEXT:+https://$ATLASSIAN_SITE$NEXT}   # _links.next is a relative URL
done
```

**Confluence: one page body in storage format:**

```bash
curl -sS "${AUTH[@]}" \
  "https://$ATLASSIAN_SITE/wiki/api/v2/pages/123456?body-format=storage" \
| jq '{id, title, body: .body.storage.value}'
```

**Confluence: CQL search:**

```bash
curl -sS "${AUTH[@]}" --get "https://$ATLASSIAN_SITE/wiki/rest/api/search" \
  --data-urlencode 'cql=type=page AND space=DOCS AND lastmodified >= "2026-08-01"' \
  --data-urlencode 'limit=25' \
| jq -c '.results[] | {id: .content.id, title: .content.title}'
```

**Watch budget headers without extra requests (attach to any call):**

```bash
curl -sS -D /dev/stderr -o /dev/null "${AUTH[@]}" \
  "https://$ATLASSIAN_SITE/rest/api/3/issue/ABC-123?fields=id" \
  2>&1 >/dev/null | grep -i -E 'ratelimit|retry-after'
```

## 7. Scheduler implications

Hard constraints a rate-limit-aware parallel scheduler must respect for this backend:

- **Bucket key = (tenant, endpoint path, HTTP method).** Burst limits are per tenant per API path per method; a 429 with `jira-burst-based` must throttle only that endpoint's queue, not the whole backend.
- **Plan to steady-state rates, not burst capacity**: default GET/POST **100 rps**, PUT/DELETE **50 rps** per endpoint; overrides: get-issue **150 rps**, per-issue changelog **200 rps**, approximate-count **150 rps** (POST). Burst buffers absorb spikes only; sustained overshoot guarantees 429s.
- **Two independent gates per request** when running as an OAuth/Forge/Connect app: hourly points quota (65,000 pts/h global-pool default, UTC-hour reset) *and* per-second burst. API-token Basic traffic bypasses the points quota (docs, as of 2026-08-12) but not burst limits — and dedicated API-token limits are live since 2025-11-22 with unpublished numbers, so keep the backoff path armed.
- **Budget in points** for app traffic: read = 1 + 1/core object (2/identity object), write = 1. A 5000-id enumeration page costs far less than 5000 single-issue GETs (each ≥ 2 points).
- **On 429, dispatch on `RateLimit-Reason`:** quota-based → **pause all requests to that product until the UTC-hour reset** (no partial throttling); `jira-burst-based` → back off that endpoint only; `jira-per-issue-on-write` → delay writes to that one issue (limits: 20/2 s, 100/30 s) while other traffic continues.
- **Honor `Retry-After` as a minimum delay**; use exponential backoff ×2 with jitter ×[0.7, 1.3], cap ≈ 30 s, **max ~4 retries** (Atlassian's own pseudocode constants). Retry only idempotent requests, and per the Confluence doc, only when `Retry-After` is present.
- **Writes are never auto-retried blind**: per-issue write windows mean a burst of retried PUTs can re-trip the limit; serialize writes per issue key.
- **Cursor lifetime is state**: `nextPageToken` expires in **7 days** — persist tokens for resumable scans and finish (or restart) within that window. Confluence cursors come from the `Link` header/`_links.next`; treat the absence of both as the authoritative end-of-scan signal.
- **Concurrency caps**: cap in-flight requests per (endpoint, method) below the steady-state rps; docs explicitly warn that "using excessive concurrency to bypass limits" degrades into more 429s. Share limiter state across workers/nodes (docs require coordinating quota consumption across threads/services).
- **Smooth the hour**: spread batch jobs across the UTC hour with random jitter instead of top-of-hour spikes (Atlassian's example: stagger every 5–10 minutes); quota has no carry-over between hours.
- **Never rate-limit-test against real tenants** (Acceptable Use Policy).
- **Token rotation is a scheduled dependency**: API tokens expire ≤ 1 year (defaults enforced since 2024-12-15/2025-03-13); the scheduler must surface expiry before it becomes a 401 storm.

## 8. Failure modes and healing signals

| Wire signal | Meaning | Healing action |
|---|---|---|
| `429` + `RateLimit-Reason: jira-quota-global-based` / `jira-quota-tenant-based` / `confluence-quota-*` + `Retry-After` | Hourly points quota exhausted (app traffic); all requests blocked until UTC-hour reset | Sleep `max(Retry-After, time-to-next-UTC-hour)`; pause the whole product queue; reduce per-request cost (`fields`, pagination) before resuming |
| `429` + `RateLimit-Reason: jira-burst-based` (often `Retry-After: 1`, `X-RateLimit-Remaining: 0`) | Per-second bucket for that endpoint drained | Back off only that endpoint; resume at steady-state rps; ≤ 4 retries, exp backoff + jitter |
| `429` + `RateLimit-Reason: jira-per-issue-on-write` | > 20 writes/2 s or > 100 writes/30 s on one issue | Queue-serialize writes to that issue key; other traffic unaffected |
| `410 Gone` on `/rest/api/2/search` or `/rest/api/3/search` | Endpoint removed (CHANGE-2046; phased/regional rollout) | Permanent — rewrite the call: `search` → `search/jql`, drop `startAt`/`total`, adopt `nextPageToken`, set explicit `fields`; count via `approximate-count`. Never retry |
| `400 Bad Request` from `search/jql` | Malformed **or unbounded** JQL (bounded query required; `orderBy` ≤ 7 fields) | Add a restriction clause (e.g. `project = X AND ...`); validate with `POST /rest/api/3/jql/match` (unverified fit) or approximate-count |
| `401 Unauthorized` | Bad or **expired** API token (max 1-year lifetime) | Rotate token; alert credential inventory. Do not loop retries — repeated failures trigger CAPTCHA which then denies all REST auth until cleared in a browser |
| `403 Forbidden` | Permission gap (or blocked auth state); *not* rate limiting per current docs | Fix account permissions/scopes; do not back off and retry |
| Search returns fewer/zero issues, no error | Permission filtering: search silently omits issues without "Browse projects"/issue-level security access | Treat unexpectedly empty result sets as a possible permission gap, not proof of absence; cross-check with `approximate-count` under an admin identity |
| `nextPageToken` rejected (scan resumed after > 7 days) | Cursor expired | Restart the scan from page 1; narrow with `updated >=` JQL to shrink the re-scan |
| Confluence response without `Link` header / `_links.next` | Last page (normal) | Terminate loop; not an error |
| `503`/transient 5xx, possibly with `Retry-After` | Platform transient, not rate limiting | Same backoff machinery; retry idempotent GETs only |
| `X-RateLimit-NearLimit: true`, or `Beta-RateLimit` starts carrying `r=` | Early warning: < 20 % capacity left / > 80 % of quota consumed | Shed load preemptively: lower concurrency, defer non-urgent queues until the next UTC hour |

## 9. Sources

All accessed 2026-08-12.

| Source | Grounded |
|---|---|
| https://developer.atlassian.com/cloud/jira/platform/rate-limiting/ (page shows "Last updated Aug 12, 2026") | Three-part model; point costs; 65k/100k+10u/130k+20u/150k+30u/500k-cap quotas; March 2, 2026 enforcement; API-token exemption from points quotas; burst defaults (100/100/50/50 rps) and custom endpoint table; per-issue write limits (20/2 s, 100/30 s); all header names and `RateLimit-Reason` values; retry pseudocode constants (4 retries, 30 s cap, 0.7–1.3 jitter); AUP testing ban |
| https://developer.atlassian.com/cloud/confluence/rate-limiting/ ("Last updated Aug 12, 2026") | Same points model for Confluence; `confluence-quota-global-based`/`-tenant-based` reasons; UTC-hour reset, no carry-over, no partial throttling; `Beta-RateLimit` `r` appears past ~80 % usage; "retry only idempotent + Retry-After present" guidance; scheduling/jitter best practices |
| https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/ (embedded OpenAPI spec, REST v3) | `search/jql` GET/POST params, defaults (maxResults 50, fields default `id`), 5000-id page max, bounded-JQL and orderBy ≤ 7 rule, reconcileIssues ≤ 50, properties ≤ 5, nextPageToken 7-day expiry, `isLast`; deprecated `/search` endpoints + CHANGE-2046 link; approximate-count; get-issue params; bulkfetch (100 issues; expand=changelog max 40); per-issue changelog (startAt/maxResults default 100); changelog/bulkfetch (1000 issues, 10 fieldIds, maxResults 1000 default/10000 max); OAuth scopes |
| https://developer.atlassian.com/cloud/confluence/rest/v2/intro/ | v2 base path, auth options, Link-header cursor pagination format, `_links.next` mirror |
| https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/ + /api-group-space/ (embedded OpenAPI spec, REST v2) | `/pages`, `/pages/{id}`, `/spaces`, `/spaces/{id}` params; limit default 25/max 250; body-format enums; `read:page:confluence` scope; server URL `https://{your-domain}/wiki/api/v2` |
| https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-search/ (embedded OpenAPI spec, REST v1) | `GET /wiki/rest/api/search` CQL params (cql, cqlcontext, cursor, limit default 25, start, excerpt default `highlight`); user-field CQL deprecation; `_links.next` cursor format |
| https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/ | Basic auth header construction, `-u` curl form, token creation location, password deprecation, CAPTCHA lockout |
| https://community.developer.atlassian.com/t/api-token-rate-limiting/92292 (official Atlassian announcement) | API-token rate limits effective Nov 22, 2025; no published numbers; `X-Beta-RateLimit-*`/`X-Beta-Retry-After` header set |
| https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/ + https://community.atlassian.com/forums/Jira-articles/API-tokens-will-now-have-a-maximum-one-year-expiry/ba-p/2880029 (via search snippets) | Token expiry 1 day–1 year; Dec 15, 2024 / Mar 13, 2025 enforcement dates |
| Secondary (removal rollout, 410 semantics): https://community.strategy.com/article/KB489535-Data-import-from-Jira-Cloud-Connector-failed-API-removed-410-Gone-Please-migrate-to-rest-api-3-search-jql ; https://github.com/atlassian/atlassian-mcp-server/issues/70 ; https://repost.aws/questions/QU72Z7DJTyRtiZsrwIZ7evYw/amazon-appflow-jira-cloud-connector-fails-with-410-gone-needs-migration-to-rest-api-3-search-jql ; https://docs.adaptavist.com/sr4jc/latest/release-notes/breaking-changes/atlassian-rest-api-search-endpoints-deprecation | 410 Gone on removed classic search; May 1 → Aug 1, 2025 removal timeline; regional/phased rollout |

Cached page copies: `.web-docs/undefined-jira-rate-limiting.md`, `undefined-confluence-rate-limiting.md`, `undefined-jira-issue-search-reference.md`, `undefined-confluence-v2-intro.md`, `undefined-confluence-v2-pages-spaces.md`, `undefined-confluence-v1-cql-search.md`, `undefined-atlassian-basic-auth.md`, `undefined-api-token-rate-limiting-announcement.md`, `undefined-api-token-expiry.md`, `undefined-jira-search-migration-change-2046.md`.
