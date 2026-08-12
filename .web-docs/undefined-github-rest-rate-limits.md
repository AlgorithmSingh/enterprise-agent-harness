# GitHub REST API — Rate limits for the REST API

- Source URL: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch). Applies to docs.github.com free/pro/team default view (API version 2022-11-28 era docs).

## Primary rate limits

| Principal | Limit |
|---|---|
| Unauthenticated | 60 requests/hour |
| Authenticated user (PAT) | 5,000 requests/hour |
| Authenticated user, GitHub Enterprise Cloud org/enterprise | 15,000 requests/hour |
| GitHub App installation (non-Enterprise) | 5,000/hour base; +50/hour per repository above 20 and per user above 20, capped at 12,500/hour |
| GitHub App installation (Enterprise Cloud) | 15,000 requests/hour |
| OAuth app (client ID/secret) | 5,000/hour (15,000 Enterprise Cloud) |
| `GITHUB_TOKEN` in GitHub Actions | 1,000 requests/hour per repository (15,000 for Enterprise Cloud) |
| Git LFS | 300 req/min unauthenticated; 3,000 req/min authenticated |

## Response headers (exact names)

| Header | Meaning |
|---|---|
| `x-ratelimit-limit` | "maximum number of requests that you can make per hour" |
| `x-ratelimit-remaining` | "number of requests remaining in the current rate limit window" |
| `x-ratelimit-used` | "number of requests you have made in the current rate limit window" |
| `x-ratelimit-reset` | "time at which the current rate limit window resets, in UTC epoch seconds" |
| `x-ratelimit-resource` | which rate limit bucket (resource) the request counted against |

## Secondary rate limits

- "No more than 100 concurrent requests are allowed" (shared across REST and GraphQL).
- "No more than 900 points per minute are allowed for REST API endpoints"; 2,000 points per minute for the GraphQL API endpoint.
- "No more than 90 seconds of CPU time per 60 seconds of real time" (of which GraphQL limited to 60 seconds CPU time).
- Content-generating requests: no more than 80/minute and 500/hour.
- No more than 2,000 OAuth access-token requests per hour.

### Point values for the secondary (per-minute) limit

| Request | Points |
|---|---|
| REST GET, HEAD, OPTIONS | 1 |
| REST POST, PATCH, PUT, DELETE | 5 |
| GraphQL without mutations | 1 |
| GraphQL with mutations | 5 |

(Some endpoints have undisclosed point costs.)

## Exceeding limits

- Primary limit exceeded: "403 or 429 response"; do not retry "until after the time specified by the `x-ratelimit-reset` header".
- Secondary limit exceeded: "403 or 429 response and an error message". If `retry-after` header present: wait that many seconds. Otherwise if `x-ratelimit-remaining` is `0`: wait until `x-ratelimit-reset`. Otherwise wait at least one minute, then exponentially increase wait between retries.
- "Continuing to make requests while you are rate limited may result in the banning of your integration."

## GET /rate_limit

- "does not count against your primary rate limit"
- "can count against your secondary rate limit"
- Prefer reading the response headers of normal requests when possible.
