---
type: reference
title: "Datadog API Retrieval and Rate Limits"
description: "Verified reference for retrieving logs, metrics, monitors, events, spans, and incidents from the Datadog API: exact endpoints, DD-API-KEY/DD-APPLICATION-KEY auth, site parameterization, cursor pagination, the X-RateLimit-* header model, published limits, official-client retry behavior, and scheduler constraints."
timestamp: "2026-08-12"
---

# Datadog API Retrieval and Rate Limits

## Overview

Datadog's public API is a JSON-over-HTTPS retrieval backend for six read surfaces this harness cares about: log events, metric timeseries, monitor definitions/state, audit-style events, APM spans, and incidents. All endpoints are served from a site-parameterized host (`https://api.<site>`), authenticate via two request headers, and — for the event-platform endpoints (logs, events, spans) — paginate with an opaque forward-only cursor. Rate limiting is org-level, communicated exclusively through `X-RateLimit-*` response headers, and, with a handful of published exceptions, **the numeric limits are not publicly documented**: they vary per org and can be raised by Datadog support. A deterministic scheduler must therefore learn its budgets from response headers at runtime rather than from this book.

All API reference pages were read on 2026-08-12 from `docs.datadoghq.com/api/latest/` (the "latest" API reference). Datadog serves a native markdown mirror of every docs page by appending `.md` to the URL, plus an index at `https://docs.datadoghq.com/llms.txt` — useful for cheap doc re-verification. Schema defaults/maxima below were cross-checked against Datadog's official OpenAPI v2 spec in the `datadog-api-client-python` repository.

## Authentication

| Item | Exact value | Source |
|---|---|---|
| API key header | `DD-API-KEY` | curl examples on every API reference page |
| Application key header | `DD-APPLICATION-KEY` | curl examples on every API reference page |
| Requirement | "Requests that write data require reporting access and require an `API key`. Requests that read data require full access and also require an `application key`." — i.e. **all retrieval calls need both headers** | [Authentication](https://docs.datadoghq.com/api/latest/authentication/) |
| Client env vars | Official clients read `DD_API_KEY` and `DD_APP_KEY` by default | TS + Python client READMEs |
| Host override env var | `DATADOG_HOST` (e.g. `https://api.datadoghq.eu`); clients default to the US site | [Authentication](https://docs.datadoghq.com/api/latest/authentication/) |
| Key validation | `GET /api/v1/validate` (API key only) | [Authentication](https://docs.datadoghq.com/api/latest/authentication/) |

Per-endpoint authorization: each read endpoint additionally requires a permission on the key pair — `logs_read_data` (logs search), `timeseries_query` (both metrics query endpoints), `monitors_read` (monitors list), `events_read` (events search), `incident_read` (incidents), and OAuth apps need the `apm_read` scope for spans search. A key that authenticates but lacks the permission gets `403`.

### Site parameterization

Each site is completely independent; data and keys do not cross sites. The API host is `https://api.<site parameter>`:

| Site | Site parameter | API endpoint host | Location |
|---|---|---|---|
| US1 | `datadoghq.com` | `api.datadoghq.com` | US |
| US3 | `us3.datadoghq.com` | `api.us3.datadoghq.com` | US |
| US5 | `us5.datadoghq.com` | `api.us5.datadoghq.com` | US |
| EU1 | `datadoghq.eu` | `api.datadoghq.eu` | EU (Germany) |
| US1-FED | `ddog-gov.com` | `api.ddog-gov.com` | US (FedRAMP High) |
| US2-FED | `us2.ddog-gov.com` | `api.us2.ddog-gov.com` | US (IL5 in process) |
| AP1 | `ap1.datadoghq.com` | `api.ap1.datadoghq.com` | Japan |
| AP2 | `ap2.datadoghq.com` | `api.ap2.datadoghq.com` | Australia |
| UK1 | `uk1.datadoghq.com` | `api.uk1.datadoghq.com` | UK |

Official clients select the site via a server variable: TypeScript `configuration.setServerVariables({ site: "datadoghq.eu" })`; Python `configuration.server_variables["site"] = "datadoghq.eu"`.

## Retrieval surface

| Family | Method + path | Version | Permission | Pagination style |
|---|---|---|---|---|
| Logs search | `POST /api/v2/logs/events/search` | v2 | `logs_read_data` | cursor (`page.cursor` / `meta.page.after`) |
| Logs search (GET form) | `GET /api/v2/logs/events` | v2 | `logs_read_data` | cursor (`page[cursor]`) |
| Metrics timeseries | `GET /api/v1/query` | v1 | `timeseries_query` | none (slice time ranges) |
| Metrics timeseries (multi-source) | `POST /api/v2/query/timeseries` | v2 | `timeseries_query` | none |
| Monitors list | `GET /api/v1/monitor` | v1 | `monitors_read` | page/`page_size` or `id_offset` |
| Events search | `POST /api/v2/events/search` | v2 | `events_read` | cursor |
| Spans search (APM) | `POST /api/v2/spans/events/search` | v2 | OAuth scope `apm_read` | cursor |
| Incidents list | `GET /api/v2/incidents` | v2 (public beta) | `incident_read` | `page[size]` / `page[offset]` |
| Incidents search | `GET /api/v2/incidents/search` | v2 (public beta) | `incident_read` | `page[size]` / `page[offset]` |

Minimal-payload parameters per endpoint (all verified from the API reference pages and the official OpenAPI v2 spec):

**Logs search (POST)** — body fields: `filter.query` (log search syntax), `filter.from` / `filter.to` (date math like `now-15m` or millisecond timestamps), `filter.indexes` (default `['*']`), `filter.storage_tier` (enum `indexes|online-archives|flex`), `sort` (enum `timestamp|-timestamp`), `page.limit` (int32, **default 10, maximum 1000**), `page.cursor`. The GET form takes the same values as query params: `filter[query]`, `filter[from]`, `filter[to]`, `filter[indexes]`, `filter[storage_tier]`, `sort`, `page[cursor]`, `page[limit]`.

**Metrics v1 query** — query strings, all required: `from` (start, **seconds** since Unix epoch), `to` (end, seconds), `query` (metrics query string, e.g. `avg:system.cpu.user{*}by{host}`). Response `series[].pointlist` timestamps are in **milliseconds**.

**Metrics v2 timeseries** — body: `data.type` = `"timeseries_request"`, `data.attributes.from` / `.to` (int64, **milliseconds** since epoch), `data.attributes.queries[]` (each with `data_source` — `metrics`/`cloud_cost`, events-platform sources `logs, spans, network, rum, security_signals, profiles, audit, events, ci_tests, ci_pipelines`, APM stats sources `apm_resource_stats, apm_metrics, apm_dependency_stats`, or `slo`/`process`/`container`; metrics queries take `query` + optional `name`), optional `formulas[]`, optional `interval` (ms; "may be overridden by a larger interval if the query would result in too many points").

**Monitors list** — query strings: `group_states` (`all`, `alert`, `warn`, `no data`), `name`, `tags`, `monitor_tags`, `with_downtimes` (bool), `id_offset`, `page`, `page_size`. If `page` is not specified the request returns **all monitors without pagination**; if `page` is specified and `page_size` is not, `page_size` defaults to **100**.

**Events search** — body: `filter.query` (event search syntax), `filter.from` / `filter.to` (date math or ms timestamps), `sort` (`timestamp|-timestamp`), `page.limit` (default 10, max 1000), `page.cursor`. Options: `timezone` or `timeOffset` — supplying both fails the query.

**Spans search** — body wrapped in JSON:API envelope: `data.type` = `"search_request"`, `data.attributes.filter.query/from/to` (ISO8601, date math, or ms), `data.attributes.sort` (`timestamp|-timestamp`), `data.attributes.page.limit` (default 10, max 1000), `data.attributes.page.cursor`.

**Incidents** — list: `page[size]` (**maximum 100**), `page[offset]`, `include`. Search: required `query` using incident facets, e.g. `state:active AND severity:(SEV-2 OR SEV-1)`; `sort` enum `created|-created`; same `page[size]`/`page[offset]`. Both endpoints are marked **public beta**; the Python client gates them behind `configuration.unstable_operations["list_incidents"] = True`.

## Pagination

**Cursor family (logs, events, spans).** Identical mechanics on all three:

1. First request: set `page.limit` (≤1000) and an absolute `filter.from`/`filter.to`.
2. Response carries `meta.page.after` — an opaque base64 cursor — plus `links.next` (a prebuilt GET URL with `page[cursor]`).
3. Next request: resend the **same** query with `page.cursor` = previous `meta.page.after`. Per the API reference: "To make the next request, use the same parameters with the addition of the `page[cursor]`."
4. Termination: per the pagination guide, "When you see `data` returns null, you have returned all pages"; treat a missing `meta.page.after` or an empty `data` array as end-of-results.

The cursor chain is strictly sequential — page N+1's cursor only exists in page N's response. The guide's explicit warning: "For better control over pagination results, use an absolute `time` parameter - don't use the `now` keyword."

Note one doc inconsistency: the pagination guide's v2 tab says the limit "equals `50` by default, but can be set up to `1000`", while the OpenAPI schema (`LogsListRequestPage`, `EventsRequestPage`, `SpansListRequestPage`) says `default: 10, maximum: 1000`. Trust the schema; always set `page.limit` explicitly so the discrepancy is moot.

**Monitors (v1).** Classic page-number pagination: `page` (0-based start) + `page_size` (default 100 once `page` is given). Alternative documented pattern: `id_offset` — "Start with a value of zero, make a request, set the value to the last ID of result set, and then repeat until the response is empty." Omitting `page` returns everything in one response.

**Incidents (v2).** Offset pagination: `page[size]` ≤ 100 and `page[offset]`.

**Metrics.** No pagination. Shard long ranges into multiple `from`/`to` windows; the v2 endpoint may silently coarsen `interval` for wide windows.

## Rate limits

Datadog's model (rate-limits page, read 2026-08-12): "Many API endpoints are rate limited... The rate limits for endpoints vary and are included in the headers detailed below. These can be extended on demand." Limits can be raised via a support ticket (cite the `X-RateLimit-Name` value); "there is a maximum to how much a rate limit can be increased." Buckets are not one-per-endpoint: "APIs can have unique, distinct rate limit buckets or be grouped together into a single bucket depending on the resource(s) being used," and usage is tracked per **org**, per **user**, and per **API key** dimensions.

### Published numbers (complete list as of 2026-08-12)

| Endpoint family | Published limit | Source page |
|---|---|---|
| Metric / data point submission | **Not rate limited** ("Datadog does not rate limit on data point/metric submission"; custom-metric count is governed by contract instead) | rate-limits |
| Log ingestion (`POST /api/v2/logs`) | **Not rate limited** ("The API for sending logs is not rate limited") | rate-limits |
| Event submission | **250,000 events per minute per organization** | rate-limits |
| Spans search (`POST /api/v2/spans/events/search`) | **300 requests per hour** | spans search API reference |
| Logs search, metrics query, monitors, events search, incidents | **No public number.** Limits "vary and are included in the headers"; per-org, raisable | rate-limits |

The rate-limits page carries an explicit warning that this list "is not comprehensive of all rate limits on Datadog APIs."

### Response headers (exact names)

| Header | Documented meaning |
|---|---|
| `X-RateLimit-Limit` | "number of requests allowed in a time period" |
| `X-RateLimit-Period` | "length of time in seconds for resets (**calendar aligned**)" |
| `X-RateLimit-Remaining` | "number of allowed requests left in the current time period" |
| `X-RateLimit-Reset` | "time in seconds until next reset" — a **relative delta**, not an epoch timestamp |
| `X-RateLimit-Name` | "name of the rate limit for increase requests" — the bucket identifier |

### Error semantics

| Status | Meaning on this backend | Body |
|---|---|---|
| `400` | Bad request (malformed body/query) | `{"errors": ["..."]}` |
| `403` | **Not Authorized** — missing/invalid `DD-API-KEY`/`DD-APPLICATION-KEY`, missing permission (e.g. `logs_read_data`), or the key belongs to a different site. Never a rate-limit signal. | `{"errors": ["..."]}` |
| `429` | Rate limited: "Too many requests: The rate limit set by the API has been exceeded." Wait `X-RateLimit-Reset` seconds (or a full `X-RateLimit-Period`), then retry. | `{"errors": ["..."]}` |

Datadog documents **no `Retry-After` header**; the reset signal is `X-RateLimit-Reset`. (The official TypeScript client's retry logic likewise keys on "the value of the x-ratelimit-reset response header when available".)

### Observing remaining budget cheaply

- **Free with every call:** read `X-RateLimit-Remaining` / `-Reset` / `-Name` from responses you are already making (`curl -D -`). There is no dedicated "rate limit status" endpoint.
- **Fleet-wide:** Datadog emits usage metrics for rate-limited API endpoints (excluding metrics, logs, and event submission): `datadog.apis.usage.per_org`, `.per_user`, `.per_api_key`, plus `_ratio` variants normalized to the limit period — tagged with `limit_name`, `limit_count`, `limit_period`, `rate_limit_status` (`passed`/`blocked`), `app_key_id`, `user_uuid`. Query them through the metrics query endpoint itself, e.g. `default_zero(sum:datadog.apis.usage.per_org{rate_limit_status:blocked} by {limit_name})`.

## Deterministic retrieval recipes

All recipes assume:

```bash
export DD_SITE="datadoghq.com"          # site parameter from the table above
export DD_API_KEY="..." DD_APP_KEY="..."
DD="https://api.${DD_SITE}"
AUTH=(-H "DD-API-KEY: ${DD_API_KEY}" -H "DD-APPLICATION-KEY: ${DD_APP_KEY}")
```

**1. Validate credentials / site (API key only):**

```bash
curl -sS "${DD}/api/v1/validate" -H "DD-API-KEY: ${DD_API_KEY}"   # {"valid":true}
```

**2. Logs search, minimal payload, one page:**

```bash
curl -sS -X POST "${DD}/api/v2/logs/events/search" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"filter":{"query":"service:web status:error","from":"2026-08-12T00:00:00Z","to":"2026-08-12T01:00:00Z"},
       "sort":"timestamp","page":{"limit":1000}}' \
  | jq -c '{n:(.data|length), after:.meta.page.after, status:.meta.status}'
```

**3. Logs search, full cursor drain (sequential by construction):**

```bash
CURSOR=""
while :; do
  PAGE=$(jq -n --arg c "$CURSOR" '{limit:1000} + (if $c=="" then {} else {cursor:$c} end)')
  RESP=$(curl -sS -X POST "${DD}/api/v2/logs/events/search" \
    -H "Content-Type: application/json" "${AUTH[@]}" \
    -d "{\"filter\":{\"query\":\"service:web\",\"from\":\"2026-08-12T00:00:00Z\",\"to\":\"2026-08-12T01:00:00Z\"},\"sort\":\"timestamp\",\"page\":${PAGE}}")
  jq -c '.data[]?' <<<"$RESP"                     # one JSON log per line
  CURSOR=$(jq -r '.meta.page.after // empty' <<<"$RESP")
  [ -z "$CURSOR" ] && break
done
```

**4. Metrics v1 timeseries (from/to in epoch seconds):**

```bash
curl -sS -G "${DD}/api/v1/query" "${AUTH[@]}" \
  --data-urlencode "from=$(date -v-1H +%s)" \
  --data-urlencode "to=$(date +%s)" \
  --data-urlencode "query=avg:system.cpu.user{*}by{host}" \
  | jq -c '.series[] | {metric, scope, points:(.pointlist|length)}'
```

**5. Metrics v2 timeseries (from/to in epoch milliseconds):**

```bash
curl -sS -X POST "${DD}/api/v2/query/timeseries" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{\"data\":{\"type\":\"timeseries_request\",\"attributes\":{
        \"from\":$(($(date -v-1H +%s)*1000)),\"to\":$(($(date +%s)*1000)),
        \"queries\":[{\"data_source\":\"metrics\",\"query\":\"avg:system.cpu.user{*}\",\"name\":\"a\"}]}}}" \
  | jq -c '.data.attributes | {series:(.series|length), times:(.times|length)}'
```

**6. Monitors list, paged, ids+states only:**

```bash
curl -sS -G "${DD}/api/v1/monitor" "${AUTH[@]}" \
  --data-urlencode "page=0" --data-urlencode "page_size=100" \
  | jq -c '.[] | {id, name, overall_state: .overall_state}'
```

**7. Events search (cursor pagination identical to logs):**

```bash
curl -sS -X POST "${DD}/api/v2/events/search" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"filter":{"query":"source:alert","from":"now-15m","to":"now"},"page":{"limit":1000},"sort":"timestamp"}' \
  | jq -c '{n:(.data|length), after:.meta.page.after}'
```

**8. Spans search (budget: 300/hour) — note the JSON:API envelope:**

```bash
curl -sS -X POST "${DD}/api/v2/spans/events/search" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"data":{"type":"search_request","attributes":{
        "filter":{"query":"service:web @http.status_code:500","from":"now-15m","to":"now"},
        "page":{"limit":1000},"sort":"timestamp"}}}' \
  | jq -c '{n:(.data|length), after:.meta.page.after}'
```

**9. Incidents search (public beta):**

```bash
curl -sS -G "${DD}/api/v2/incidents/search" "${AUTH[@]}" \
  --data-urlencode 'query=state:active AND severity:(SEV-2 OR SEV-1)' \
  --data-urlencode 'page[size]=100' \
  | jq -c '.data[]? | {id, type}'
```

**10. Observe the rate budget of any call without extra requests:**

```bash
curl -sS -D /dev/stderr -o /dev/null -G "${DD}/api/v1/monitor" "${AUTH[@]}" \
  2>&1 >/dev/null | grep -i '^x-ratelimit'
```

### Official clients: automatic 429 retry

| Client | Package | Retry switch | Verified behavior |
|---|---|---|---|
| TypeScript | `@datadog/datadog-api-client` | `enableRetry: true` in `createConfiguration` opts (off by default) | Retries on **429 and status ≥ 500**. Sleep = `x-ratelimit-reset` header value when present, else `(backoffMultiplier ** current_retry_count) * backoffBase`. Max attempts **3 by default**, override with `maxRetries`. |
| Python | `datadog-api-client` | `configuration.enable_retry = True` (off by default) | Retries on **429**. Default max retry **3**, override `configuration.max_retries`. A custom `urllib3.util.Retry` passed as `Configuration(retry_policy=...)` takes precedence over `enable_retry`, `retry_backoff_factor`, and `max_retries` (use it to also cover 5xx). |

Both clients read `DD_API_KEY`/`DD_APP_KEY` from the environment by default and default to the US1 site.

## Scheduler implications

Hard constraints for a rate-limit-aware parallel scheduler using Datadog:

- **Never hardcode budgets.** Except for spans search (300/hour) and event submission (250k/min), Datadog publishes no numbers; limits vary per org and change when support raises them. Learn `(limit, period, remaining, reset)` from `X-RateLimit-*` headers on every response and key state by `X-RateLimit-Name`.
- **Bucket by `X-RateLimit-Name`, not by URL.** Different endpoints can share one bucket ("grouped together into a single bucket"), so per-endpoint token buckets can double-spend a shared budget until the name is observed.
- **Spans search is a hard 300 req/hour budget** — sustained ≤ 5/min. With `page.limit: 1000` that caps span retrieval at ≤ 300,000 spans/hour; shard by time window and query selectivity, never by page fan-out.
- **Cursor pagination is inherently sequential** (logs, events, spans): page N+1 requires page N's `meta.page.after`. Parallelism must come from disjoint query shards (e.g. non-overlapping `from`/`to` windows with absolute timestamps), not from concurrent pages of one cursor chain.
- **Always set `page.limit` to the documented maximum (1000)** for logs/events/spans drains to minimize request count; incidents pages cap at `page[size]=100`.
- **On 429: freeze the named bucket** for `X-RateLimit-Reset` seconds (a relative delta) before any retry; periods are calendar-aligned, so budgets refill at period boundaries, not on a rolling window. There is no `Retry-After` header to consult.
- **403 is not a backoff signal** — it is an auth/permission/site error; retrying it burns budget for nothing. Route to credential healing instead.
- **Limits bind at org level** (usage metrics expose `per_org` alongside `per_user`/`per_api_key`), so adding API keys must not be assumed to multiply throughput; treat the org as the top-level budget owner shared with every other consumer in the org.
- **Metrics queries have no cursor** — a scheduler can freely parallelize disjoint `from`/`to` windows, but the v2 endpoint may coarsen `interval` on wide windows; fix the window width if deterministic resolution matters.
- **Use absolute time bounds everywhere** (documented guidance: avoid `now`) so retried or resumed drains are idempotent and pages do not shift mid-run.
- **Check `meta.status` on every event-platform response**: `timeout` (vs `done`) and any `meta.warnings` mean partial results — the run is not deterministic-complete and must be narrowed and retried, not accepted.

## Failure modes and healing signals

| Failure | On the wire | Healing action |
|---|---|---|
| Invalid/missing API or app key; missing permission; wrong site | HTTP `403`, body `{"errors":["..."]}` (docs label: "Not Authorized") | Probe `GET /api/v1/validate` with the API key against candidate sites (sites are fully independent); if valid, the gap is the application key's permission (`logs_read_data`, `timeseries_query`, `monitors_read`, `events_read`, `incident_read`, `apm_read`) — fix the key, don't retry. |
| Rate limited | HTTP `429`, body `{"errors":["..."]}`, headers `X-RateLimit-Limit/-Period/-Remaining/-Reset/-Name` | Sleep `X-RateLimit-Reset` seconds; freeze all requests sharing that `X-RateLimit-Name`; if chronic, request an increase via support quoting the name, or (clients) turn on `enableRetry`/`enable_retry`. |
| Malformed query/body | HTTP `400`, `{"errors":["Bad Request"]}` | Do not retry unchanged; validate JSON body shape (spans/metrics-v2 need their `data.type` envelope — `search_request` / `timeseries_request`). |
| Query timed out server-side | HTTP `200` but `meta.status: "timeout"` (enum is `done,timeout`) | Treat as partial; shrink the time window or tighten the query, then rerun. Exit code is 0 — scripts must check the field explicitly. |
| Partial results from bad index etc. | HTTP `200` with `meta.warnings[]`, e.g. `code: "unknown_index"` | Log warning code/detail; correct `filter.indexes`; results returned are only from valid indexes. |
| End of pagination | HTTP `200`, `data` empty/null, `meta.page.after` absent | Normal termination of the cursor loop, not an error. |
| Monitors accidental full dump | Omitting `page` returns all monitors in one unpaginated response | Always pass `page` + `page_size` for bounded, deterministic pages. |
| Incidents endpoints missing/erroring in clients | Python client raises unless `configuration.unstable_operations["list_incidents"] = True`; endpoints are public beta and may change | Gate incident retrieval behind a feature flag; pin client versions. |
| Silent interval coarsening (metrics v2) | HTTP `200`, returned point spacing larger than requested `interval` | Compare requested vs returned interval; re-query with narrower `from`/`to` windows if fixed resolution is required. |

## Sources

All accessed 2026-08-12. Datadog docs were read via the vendor's native markdown mirrors (`.md` suffix on each docs URL).

| URL | Grounds |
|---|---|
| https://docs.datadoghq.com/api/latest/rate-limits/ | Rate-limit model, `X-RateLimit-*` header names/semantics, 429 behavior, 250,000 events/min/org, "submission not rate limited" statements, per-org variability and support-raise process, `datadog.apis.usage.*` metrics and tags |
| https://docs.datadoghq.com/api/latest/authentication/ | `API key` vs `application key` requirement, `DATADOG_HOST`, `GET /api/v1/validate` per-site table |
| https://docs.datadoghq.com/getting_started/site.md | Site table (US1/US3/US5/EU1/US1-FED/US2-FED/AP1/AP2/UK1), site parameters, site independence |
| https://docs.datadoghq.com/api/latest/logs/ | Logs API endpoint inventory (`POST /api/v2/logs`, `GET /api/v2/logs/events`, `POST /api/v2/logs/events/search`, aggregate) |
| https://docs.datadoghq.com/api/latest/logs/search-logs-post.md | Logs search body schema, `logs_read_data`, `DD-API-KEY`/`DD-APPLICATION-KEY` curl example, response `meta.page.after`/`meta.status`/`meta.warnings`, 400/403/429 responses |
| https://docs.datadoghq.com/api/latest/logs/search-logs-get.md | GET-form query params `filter[...]`, `page[cursor]`, `page[limit]` |
| https://docs.datadoghq.com/logs/guide/collect-multiple-logs-with-pagination.md | Cursor loop mechanics, termination condition, absolute-time guidance, v1 `logs-queries/list` legacy pattern |
| https://docs.datadoghq.com/api/latest/metrics/ | Metrics endpoint inventory (`GET /api/v1/query`, `POST /api/v2/query/timeseries`) |
| https://docs.datadoghq.com/api/latest/metrics/query-timeseries-points.md | v1 query params (`from`/`to` epoch seconds, `query`), `timeseries_query` permission, response schema (pointlist ms) |
| https://docs.datadoghq.com/api/latest/metrics/query-timeseries-data-across-multiple-products.md | v2 timeseries body schema, data sources, ms timestamps, interval override behavior |
| https://docs.datadoghq.com/api/latest/monitors/get-all-monitors.md | `GET /api/v1/monitor` params, `page_size` default 100, unpaginated default, `id_offset` pattern, `monitors_read` |
| https://docs.datadoghq.com/api/latest/events/search-events.md | `POST /api/v2/events/search` body, `events_read`, cursor fields, timezone/timeOffset exclusivity |
| https://docs.datadoghq.com/api/latest/spans/search-spans.md | `POST /api/v2/spans/events/search`, **300 requests/hour**, `search_request` envelope, `apm_read` scope, 429 text |
| https://docs.datadoghq.com/api/latest/incidents/get-a-list-of-incidents.md | `GET /api/v2/incidents`, public beta, `page[size]` max 100, `incident_read` |
| https://docs.datadoghq.com/api/latest/incidents/search-for-incidents.md | `GET /api/v2/incidents/search`, query facet syntax, sort enum, paging |
| https://raw.githubusercontent.com/DataDog/datadog-api-client-python/master/.generator/schemas/v2/openapi.yaml | Official OpenAPI v2 spec: `page.limit` default 10 / max 1000 for logs, events, spans; `timeseries_request` type enum |
| https://raw.githubusercontent.com/DataDog/datadog-api-client-typescript/master/README.md | `enableRetry`, 429/≥500 retry, `x-ratelimit-reset` sleep, `maxRetries` default 3, `DD_API_KEY`/`DD_APP_KEY`, `setServerVariables({site})` |
| https://raw.githubusercontent.com/DataDog/datadog-api-client-python/master/README.md | `enable_retry`, default max retry 3, `retry_policy` precedence, `unstable_operations`, `server_variables["site"]` |
