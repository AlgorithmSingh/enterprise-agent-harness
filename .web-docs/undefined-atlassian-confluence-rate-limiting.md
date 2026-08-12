# Atlassian — Confluence Cloud rate limiting

- Source URL: https://developer.atlassian.com/cloud/confluence/rate-limiting/
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch). Current (2025+) points-based model; the older "per user, per app" framing does not appear on this page.

## Scope

Points-based quota applies per app. Tier 1 — Global Pool (default): "Your app shares a single 65,000 point hourly quota across all tenants." Tier 2 — Per-tenant pool: 100,000–150,000 base + per-user multiplier by edition, capped at 500,000 points/hour.

## Response codes

HTTP **429 Too Many Requests** when limits are exceeded.

## Headers

- `Retry-After` — "Only returned with 429 responses. Indicates how many seconds to wait before retrying."
- `X-RateLimit-Limit` — maximum request rate for current scope
- `X-RateLimit-Remaining` — remaining capacity in current window
- `X-RateLimit-Reset` — ISO 8601 timestamp of window reset
- `X-RateLimit-NearLimit` — `true` when less than 20% of quota remains
- `RateLimit-Reason` — reason for throttling (e.g., `confluence-quota-global-based`)
- `Beta-RateLimit-Policy`, `Beta-RateLimit` — beta structured quota reporting

## Recommended backoff

"exponential backoff and add random jitter to delays"; "Double the delay after each 429, up to a maximum."
