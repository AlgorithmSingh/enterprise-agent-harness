# Atlassian — Jira Cloud platform rate limiting

- Source URL: https://developer.atlassian.com/cloud/jira/platform/rate-limiting/
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch). This is the CURRENT (2025+) model: the page describes per-tenant + per-endpoint enforcement with a points-based hourly quota; it does NOT describe the older "per user, per app" framing.

## Scope

Rate limiting applies **per-tenant and per-API-endpoint**, not per-user. Three independent systems enforce simultaneously:

1. **Points-based cost budget (hourly)** — "Measures the total 'work' your app performs each hour using a points system"
2. **Burst API rate limits (per-second)** — per-endpoint request throttling (token bucket)
3. **Per-issue write limits** — restricts updates to individual issues

## Response codes

- HTTP **429 Too Many Requests** when any limit is exceeded.
- HTTP **503** for transient failures; may also include `Retry-After`.

## Headers

| Header | Meaning |
|---|---|
| `Retry-After` | "Indicates how many seconds to wait before retrying" |
| `X-RateLimit-Limit` | maximum request rate for current scope |
| `X-RateLimit-Remaining` | remaining capacity within window |
| `X-RateLimit-Reset` | "ISO 8601 timestamp when the current window resets" |
| `X-RateLimit-NearLimit` | `true` when less than 20% of capacity remains |
| `RateLimit-Reason` | limit type: `jira-quota-global-based`, `jira-burst-based`, `jira-per-issue-on-write` |
| `Beta-RateLimit-Policy`, `Beta-RateLimit` | beta, structured quota information |

## Cost budget (points/hour)

- Tier 1 — Global pool (default): **65,000 points/hour shared across all tenants of the app**.
- Tier 2 — Per-tenant pool: Standard **100,000 + 10 × users**; Premium **130,000 + 20 × users**; Enterprise **150,000 + 30 × users**; capped at **500,000 points/hour**.
- Object costs: core objects GET = 1 point; identity/access GET = 2 points; write operations = 1 point. Unlisted objects default to 1 point.

## Burst limits (per second, token bucket)

- Defaults by method: GET 100 rps, POST 100 rps, PUT 50 rps, DELETE 50 rps.
- Custom endpoint thresholds range 5–400 rps.
- "Each bucket holds a certain number of tokens, and the number of available tokens at any moment determines how many requests to that endpoint are allowed."

## Per-issue write limits

- Short window: 20 writes per 2 seconds.
- Long window: 100 writes per 30 seconds.

## Atlassian's recommended backoff

Exponential backoff with jitter: start ~2 s base; double per retry (2, 4, 8, 16 s); jitter by multiplying by a random factor 0.7–1.3; cap at 30 s; limit to ~4 retries. "If present, use the `Retry-After` header value as the minimum delay."
