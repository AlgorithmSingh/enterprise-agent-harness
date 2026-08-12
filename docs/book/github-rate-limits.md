---
type: reference
title: "GitHub API Rate Limits (REST, GraphQL, Search)"
description: "Verified reference for GitHub REST, GraphQL, and Search API rate limits — exact per-hour/per-minute budgets, secondary-limit point costs, resource buckets, response headers, 403/429 semantics, and scheduler rules for a rate-limit-aware retrieval pipeline."
timestamp: "2026-08-12"
---

# GitHub API Rate Limits (REST, GraphQL, Search)

All constants below were read from official GitHub Docs pages on 2026-08-12 (cached under `.web-docs/undefined-github-*.md`). The REST rate-limits page was fetched with the `?apiVersion=2026-03-10` query parameter supplied by the pipeline; header names, endpoint paths, and numbers are as published on the live pages that day. Anything not seen in a fetched page is marked "(unverified)".

## 1. Overview

GitHub enforces two layers of throttling on `api.github.com`:

- **Primary rate limits** — per-hour request (REST) or point (GraphQL) budgets, tracked per authenticated identity, split into independent **resource buckets** (`core`, `search`, `code_search`, `graphql`, …). Exhausting one bucket does not affect the others.
- **Secondary rate limits** — abuse-prevention limits that apply on top of primary limits: a concurrency cap shared across REST and GraphQL, points-per-minute budgets, content-creation caps, and CPU-time caps. GitHub states these are subject to change without notice.

For a deterministic retrieval pipeline, GitHub is the backend where budget accounting matters most: every page of a paginated listing costs one request, search lives in per-minute buckets an order of magnitude smaller than `core`, and writes cost 5x reads against the per-minute point budget. The scheduler must model buckets separately, cap global concurrency, and obey a strict header-driven backoff protocol (Section 5).

## 2. Authentication

The authentication *type* determines the primary budget (see Section 5).

| Mechanism | Exact usage (verified) |
|---|---|
| REST auth header | `Authorization: Bearer <TOKEN>` (docs examples), with `Accept: application/vnd.github+json` |
| GraphQL auth header | `Authorization: bearer <TOKEN>` on `POST https://api.github.com/graphql` |
| `gh` CLI env vars | `GH_TOKEN`, then `GITHUB_TOKEN` (in order of precedence) for github.com / `ghe.com` subdomains; `GH_ENTERPRISE_TOKEN`, then `GITHUB_ENTERPRISE_TOKEN` for GitHub Enterprise Server hosts (verified from `gh help environment`, gh v2.92.0) |
| API version header | `X-GitHub-Api-Version` (verified from the API-versions page; supported version names include `2022-11-28` and `2026-03-10`) |

Notes verified from the docs:

- Requests made with a PAT **and** requests made by a GitHub App or OAuth app *on behalf of a user* all draw from that user's single personal budget.
- GitHub App *installation* tokens and OAuth app *client-credential* requests have their own budgets (table in Section 5).
- Unauthenticated requests are allowed but capped at 60/hour — effectively unusable for a pipeline.

## 3. Retrieval surface

Rate-limit-relevant endpoints (all under `https://api.github.com`):

| Endpoint | Method | Purpose | Minimal-payload notes |
|---|---|---|---|
| `/rate_limit` | GET | Read all bucket budgets | Does **not** count against the primary REST limit; returns `resources` object (Section 5). Statuses: 200, 304, 404 |
| `/graphql` | POST | All GraphQL queries/mutations | Single endpoint; JSON body `{"query": "..."}`; always POST |
| `/search/code` | GET | Code search | `code_search` bucket, 10 req/min (auth required) |
| `/search/commits` | GET | Commit search | `search` bucket |
| `/search/issues` | GET | Issue/PR search | `search` bucket; semantic/hybrid issue search is 10 req/min, auth required |
| `/search/labels` | GET | Label search | `search` bucket |
| `/search/repositories` | GET | Repository search | `search` bucket |
| `/search/topics` | GET | Topic search | `search` bucket |
| `/search/users` | GET | User search | `search` bucket |

Payload-minimizing parameters (verified): `per_page` (max 100 for most endpoints, search defaults to 30) reduces the number of paginated requests; conditional-request headers `if-none-match` (ETag) and `if-modified-since` (Last-Modified) make unchanged responses free of primary budget (Section 5). GraphQL lets you select exactly the fields you need, but per-connection `first`/`last` must be 1–100.

## 4. Pagination

Verified mechanics from the pagination guide:

- Paginated REST responses carry a `link` response header with URLs annotated `rel="next"`, `rel="prev"`, `rel="first"`, `rel="last"`. Only a subset may be present (e.g. no `rel="prev"` on page 1). **Follow these URLs verbatim; do not construct page URLs by hand.**
- Page-based endpoints use the `page` query parameter; `per_page` controls page size where supported, maximum `100` for most endpoints. Some endpoints instead use cursor parameters (`before`/`after`) or `since`.
- Rate-limit interaction: every page fetch is one request against the endpoint's bucket and 1 point (GET) against the 900-points/min secondary budget. Absence of a `rel="next"` link is the termination signal.
- Search-specific cap (verified): a search query returns at most 1,000 results total regardless of pagination; repository search matches at most 4,000 repositories.

## 5. Rate limits

### 5.1 Primary limits — REST (requests per hour)

| Authentication type | Limit |
|---|---|
| Unauthenticated | 60 requests/hour per originating IP-level identity |
| Authenticated user (PAT; includes app requests on the user's behalf) | 5,000 requests/hour |
| User via higher-limit app owned by a GitHub Enterprise Cloud org | 15,000 requests/hour |
| GitHub App installation (not on a GHEC org) | 5,000/hour minimum; +50/hour per repository above 20 repos and +50/hour per user above 20 users; hard cap 12,500/hour |
| OAuth app (client credentials) | 5,000/hour per app; 15,000/hour if the app is owned by a GHEC org |
| `GITHUB_TOKEN` in GitHub Actions | 1,000 requests/hour per repository; 15,000/hour for GHEC resources |
| Git LFS (separate bucket) | 300 requests/min unauthenticated; 3,000 requests/min authenticated; 100 LFS objects per API request by default |

### 5.2 Primary limits — GraphQL (points per hour)

| Authentication type | Limit |
|---|---|
| User | 5,000 points/hour (10,000 for GHEC-org users) |
| GitHub App installation (non-GHEC) | 5,000 points/hour minimum, scaling to max 12,500 |
| GitHub App installation (GHEC org) | 10,000 points/hour |
| OAuth app (client credentials) | 5,000 points/hour; 10,000 if GHEC-owned |
| `GITHUB_TOKEN` in Actions | 1,000 points/hour per repository (15,000 for enterprise accounts) |

**GraphQL point formula** (verified, with worked example): count the requests GitHub needs to fulfill each unique connection (one request per parent node), divide the total by 100, round to nearest whole number; minimum cost per call is 1 point. Example from the docs: `repositories(first:100)` → `issues(first:50)` → `labels(first:60)` = 1 + 100 + 5,000 = 5,101 requests → **51 points**.

**GraphQL node limits** (verified): `first`/`last` must be within 1–100 on every connection; a single call may request at most **500,000 total nodes** (node count multiplies through nested connections).

### 5.3 Search limits (per minute, separate buckets)

| Scope | Limit |
|---|---|
| Authenticated, all search endpoints except code search (`search` bucket) | 30 requests/min |
| `GET /search/code` (`code_search` bucket; auth required) | 10 requests/min |
| Unauthenticated, any search endpoint | 10 requests/min |
| Semantic/hybrid issue search (auth required) | 10 requests/min |

### 5.4 Secondary limits (all APIs, on top of primary)

| Limit | Value |
|---|---|
| Concurrent requests | ≤ 100, **shared across REST and GraphQL** |
| REST points per minute | ≤ 900 points/min across REST API endpoints |
| GraphQL points per minute | ≤ 2,000 points/min for the GraphQL endpoint |
| Content-generating requests | ≤ 80/min and ≤ 500/hour in general; some endpoints lower; web-UI, REST, and GraphQL actions all count |
| CPU time | ≤ 90 s CPU per 60 s real time; ≤ 60 s of that for GraphQL |
| OAuth access token requests | ≤ 2,000/hour |

Secondary-limit point costs (distinct from GraphQL's hourly point formula): REST `GET`/`HEAD`/`OPTIONS` = 1 point; REST `POST`/`PATCH`/`PUT`/`DELETE` = 5 points; GraphQL without mutations = 1 point; GraphQL with mutations = 5 points.

### 5.5 Resource buckets — separate budgets

`GET /rate_limit` returns a `resources` object; each key is an independent budget with integer fields `limit`, `remaining`, `used`, `reset` (UTC epoch seconds):

`core` (all non-search REST), `search` (search except code), `code_search`, `graphql`, `integration_manifest`, `dependency_snapshots`, `dependency_sbom`, `code_scanning_autofix`, `copilot_usage_records`, `scim`, `actions_runner_registration`, and deprecated `source_import` ("no longer in use for any API endpoints, and it will be removed in the next API version"). The legacy top-level `rate` object is closing down — use `resources.core` instead.

### 5.6 Response headers

Present on REST **and** GraphQL responses:

| Header | Meaning |
|---|---|
| `x-ratelimit-limit` | Budget size for the bucket this request hit |
| `x-ratelimit-remaining` | Remaining in the current window |
| `x-ratelimit-used` | Used in the current window |
| `x-ratelimit-reset` | Window reset time, **UTC epoch seconds** |
| `x-ratelimit-resource` | Name of the bucket the request counted against (e.g. `core`, `search`, `code_search`, `graphql`) |
| `retry-after` | Seconds to wait before retrying (present on some secondary-limit rejections) |
| `x-poll-interval` | Minimum seconds between polls of the same endpoint (polling guidance) |

### 5.7 Error semantics: 403 vs 429, and the backoff protocol

- **REST, primary exceeded**: `403` **or** `429` (either can occur), with `x-ratelimit-remaining: 0`.
- **REST, secondary exceeded**: `403` or `429` plus an error message stating a secondary limit was hit; `retry-after` may be present.
- **GraphQL, primary exceeded**: HTTP status is still **`200`** with an error message in the body and `x-ratelimit-remaining: 0`. (The error object's `type` field value `RATE_LIMITED` is widely reported but was not confirmed in the fetched pages — unverified.)
- **GraphQL, secondary exceeded**: status `200` or `403` with a secondary-limit error message.
- **Official retry decision order** (verified, apply in exactly this order):
  1. If `retry-after` is present → wait that many seconds; do not retry earlier.
  2. Else if `x-ratelimit-remaining` is `0` → do not send another request until the `x-ratelimit-reset` epoch time.
  3. Else → wait at least one minute, retry with exponentially increasing delays, and give up with an error after a fixed number of retries.
- Continuing to send requests while rate-limited "may result in the banning of your integration."

### 5.8 Observing remaining budget cheaply

- `GET /rate_limit` reports every bucket and **does not count against the primary REST limit** (the overview page adds: it *can* count against secondary limits, so don't hammer it).
- Every normal response already carries the `x-ratelimit-*` headers for the bucket it hit — prefer reading those over extra calls (this is GitHub's explicit guidance for GraphQL too).
- Conditional GETs that return `304 Not Modified` are **free of primary budget** when the request was correctly authorized with an `Authorization` header (ETag via `if-none-match`, or `last-modified` via `if-modified-since`). Conditional requests are not supported for unsafe methods (POST/PUT/PATCH/DELETE) unless otherwise noted.

## 6. Deterministic retrieval recipes

Read all bucket budgets (free of primary budget), machine-readable:

```bash
curl -s \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/rate_limit \
| jq '{core: .resources.core, search: .resources.search,
       code_search: .resources.code_search, graphql: .resources.graphql}'
```

Same via `gh` (gh v2.92.0; honors `GH_TOKEN`/`GITHUB_TOKEN`):

```bash
gh api rate_limit --jq '.resources | {core, search, code_search, graphql}'
```

Watch the headers on any REST call without parsing the body:

```bash
curl -s -o /dev/null -D - \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/rate_limit \
| tr -d '\r' | grep -i '^x-ratelimit\|^retry-after'
```

GraphQL budget self-report (`rateLimit` object; verified fields):

```bash
curl -s -X POST \
  -H "Authorization: bearer $GITHUB_TOKEN" \
  -d '{"query":"query { rateLimit { limit cost remaining used resetAt } }"}' \
  https://api.github.com/graphql
```

Conditional request that is free on 304 (authenticated):

```bash
etag=$(curl -s -D - -o /dev/null -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO | tr -d '\r' | awk 'tolower($1)=="etag:"{print $2}')
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "If-None-Match: $etag" \
  https://api.github.com/repos/OWNER/REPO   # prints 304; costs 0 primary budget
```

Minimal search call in the small `code_search` bucket (10/min):

```bash
curl -s -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/search/code?q=QUERY&per_page=100" \
| jq '{total_count, incomplete_results, n: (.items|length)}'
```

## 7. Scheduler implications

Hard constraints a rate-limit-aware parallel scheduler MUST respect for GitHub:

- **Model buckets separately.** `core`, `search`, `code_search`, `graphql` (and the specialty buckets) are independent budgets with independent windows. Attribute every response to a bucket via `x-ratelimit-resource`; never let a drained `search` bucket stall `core` work or vice versa.
- **Global concurrency cap: 100** in-flight requests, shared across REST and GraphQL. Use one shared semaphore for both APIs; a safe pipeline stays well below 100.
- **Per-minute point budgets:** ≤ 900 points/min REST (i.e. at most 900 GETs/min, or 180 writes/min, or a weighted mix at 1/5 points each) and ≤ 2,000 points/min GraphQL (queries 1, mutation-bearing calls 5).
- **Hourly budgets by identity:** 5,000 req/hr (PAT) is the default planning number; GitHub App installations range 5,000–12,500; Actions `GITHUB_TOKEN` is only 1,000/hr per repo. The scheduler must know which identity class its token is.
- **Search is scarce:** 30 req/min (`search`), 10 req/min (`code_search`). Queue search work on its own per-minute token buckets and never fan out searches in parallel bursts.
- **Writes are serialized:** issue POST/PATCH/PUT/DELETE (and GraphQL mutations) strictly serially with ≥ 1 second between them; additionally cap content-generating requests at ≤ 80/min and ≤ 500/hour.
- **Backoff protocol is mandatory and ordered:** `retry-after` (seconds) > `x-ratelimit-remaining==0` → sleep until `x-ratelimit-reset` (epoch s) > otherwise ≥ 60 s exponential backoff with a bounded retry count. Never busy-retry: continued requests while limited risks an integration ban.
- **GraphQL responses need body inspection:** a rate-limited GraphQL call can be HTTP 200; treat `errors[]` in a 200 body as a scheduling signal, not success.
- **Keep GraphQL cost bounded:** `first`/`last` ≤ 100 everywhere, ≤ 500,000 nodes per call; estimate cost with the ÷100 formula before dispatch, or read `rateLimit { cost }` once per query shape in development.
- **Budget observability:** poll `GET /rate_limit` (free of primary budget) at a modest rate for the global view; otherwise read the `x-ratelimit-*` headers you already get on every response.
- **Cache with ETags:** authenticated 304s cost zero primary budget — persist ETag/Last-Modified per URL for all repeated reads; keep poll parameters and sort order stable; honor `x-poll-interval` where returned.

## 8. Failure modes and healing signals

| Wire signal | Diagnosis | Healing action |
|---|---|---|
| `403` or `429`, body mentions secondary rate limit, `retry-after: N` present | Secondary limit tripped | Sleep exactly N seconds; drop concurrency to 1; resume serially; re-raise concurrency gradually |
| `403` or `429`, `x-ratelimit-remaining: 0` | Primary bucket exhausted (bucket named in `x-ratelimit-resource`) | Sleep until `x-ratelimit-reset` (epoch seconds, UTC); only that bucket's queue pauses |
| `403`/`429`, secondary-limit message, no `retry-after`, `remaining > 0` | Secondary limit (points/min, CPU, or content-creation) | Wait ≥ 60 s, exponential backoff, bounded retries; slow mutative cadence to ≥ 1 s spacing |
| GraphQL HTTP `200` with `errors[]` about rate limiting, `x-ratelimit-remaining: 0` | GraphQL primary exhausted despite 200 status | Same as primary: sleep until `x-ratelimit-reset`; do not count the response as data |
| GraphQL `200` or `403` with secondary-limit error message | GraphQL secondary limit | Serialize; ≥ 1 s between mutative requests; backoff as above |
| `304 Not Modified` (empty body) on conditional GET | Cache still valid | Success path: serve cached copy; zero primary budget consumed (authenticated) |
| `incomplete_results: true` in search body (HTTP 200) | Search timed out server-side; partial results (not necessarily incomplete) | Narrow the query or retry later; do not tight-loop retries inside the 30/min or 10/min window |
| GraphQL error stating required scopes/permissions | Token lacks scopes for requested data | Not a rate issue — fix token permissions; retrying is useless |
| Repeated `4xx`/`5xx` | Persistent client/server error | Do not suppress; on expected-but-404 resources, verify credentials, then "wait much longer" before rechecking |
| `curl` exit 22 (with `-f`) / `gh api` non-zero exit with the API's error body on stderr | HTTP-level failure surfaced to the shell | Parse status + body per rows above before deciding to retry (exit-code mapping is tool behavior, not GitHub-documented) |

A script-healing agent should treat the ordered backoff protocol in Section 5.7 as the single source of truth: any retry logic that retries before `retry-after`/`x-ratelimit-reset` expiry is a bug to fix, not tune.

## 9. Sources

All accessed 2026-08-12; cached extractions live in `.web-docs/`.

| URL | Grounded |
|---|---|
| https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api (fetched with `?apiVersion=2026-03-10`) | REST primary limits per auth type; all secondary limits (100 concurrent shared REST+GraphQL, 900/2,000 points/min, 80/min + 500/hr content, 90s/60s CPU, 2,000 OAuth token req/hr); point costs per method; `x-ratelimit-*`/`retry-after` headers; 403-or-429 semantics; Git LFS bucket; `/rate_limit` "primary no / secondary maybe" note |
| https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api | Serial requests; ≥ 1 s between mutative requests; retry-after → reset → ≥ 1 min exponential backoff order; ETag/`if-none-match`, `last-modified`/`if-modified-since`; authenticated 304 = free of primary limit; unsafe methods unsupported for conditionals; webhooks over polling; `x-poll-interval` |
| https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api (canonical title now "Rate limits and query limits…", also at .../rate-limits-and-query-limits-for-the-graphql-api) | GraphQL points/hour per auth type; ÷100 point formula with 5,101→51 worked example; minimum 1 point; `first`/`last` 1–100; 500,000-node cap; `rateLimit { limit cost remaining used resetAt }`; 200-status-on-primary-exceeded; 200-or-403 on secondary; prefer headers over querying; ≥ 1 s mutative pause |
| https://docs.github.com/en/rest/rate-limit/rate-limit | `GET /rate_limit` path; "does not count against your REST API rate limit"; 200/304/404; `resources` bucket schema (`core`, `search`, `code_search`, `graphql`, `integration_manifest`, `dependency_snapshots`, `dependency_sbom`, `code_scanning_autofix`, `copilot_usage_records`, `scim`, `actions_runner_registration`, deprecated `source_import`); `limit`/`remaining`/`used`/`reset` fields; deprecated top-level `rate` object |
| https://docs.github.com/en/rest/search/search | 30 req/min authenticated search; 10 req/min code search; 10 req/min unauthenticated; 10 req/min semantic/hybrid issue search; 1,000-result cap; 4,000-repository scope cap; `per_page` max 100 / default 30; `incomplete_results`; search endpoint paths |
| https://docs.github.com/en/graphql/guides/forming-calls-with-graphql | `https://api.github.com/graphql` endpoint; POST-only; `Authorization: bearer TOKEN`; scope error behavior |
| https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api | `link` header with `rel="next"/"prev"/"first"/"last"`; `page`/`per_page` (max 100 most endpoints); cursor (`before`/`after`)/`since` variants; follow header URLs verbatim |
| https://docs.github.com/en/rest/about-the-rest-api/api-versions | `X-GitHub-Api-Version` request header; supported REST API versions `2022-11-28` and `2026-03-10` |
| Local verification (not a web source) | `gh` v2.92.0: `gh api <path|graphql>`; env vars `GH_TOKEN`/`GITHUB_TOKEN` precedence (from `gh help environment`) |
