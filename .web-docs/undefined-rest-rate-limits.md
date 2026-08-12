Source: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
Accessed: 2026-08-12

# GitHub REST API rate limits

## Primary rate limits

| Actor | Limit |
|---|---|
| Unauthenticated | 60 requests/hour |
| Authenticated user (PAT, OAuth-authorized, App on behalf of user) | 5,000 requests/hour |
| Authenticated user, Enterprise Cloud (via org-owned GitHub App or org-owned/approved OAuth app) | 15,000 requests/hour |
| GitHub App installation (non-enterprise) | 5,000/hour base; +50/hour per repository above 20 and per user above 20; capped at 12,500/hour |
| GitHub App installation (Enterprise Cloud org) | 15,000 requests/hour |
| OAuth app (client_id/secret) | 5,000/hour (15,000 for Enterprise Cloud) |
| GITHUB_TOKEN in GitHub Actions | 1,000 requests/hour per repository (15,000 for Enterprise Cloud) |

Git LFS: 300 req/min unauthenticated, 3,000 req/min authenticated; up to 100 objects per batch.

## Secondary rate limits

- No more than 100 concurrent requests (shared between REST and GraphQL).
- No more than 900 points per minute to REST API endpoints; no more than 2,000 points per minute to the GraphQL API.
  - Points: REST GET/HEAD/OPTIONS = 1; REST POST/PATCH/PUT/DELETE = 5; GraphQL without mutations = 1; GraphQL with mutations = 5.
- No more than 90 seconds of CPU time per 60 seconds of real time (of which at most 60 seconds CPU for GraphQL).
- No more than 80 content-generating requests per minute and no more than 500 content-generating requests per hour.
- No more than 2,000 OAuth access-token requests per hour.

## Response headers (exact names)

- `x-ratelimit-limit`: maximum requests per hour
- `x-ratelimit-remaining`: requests remaining in current window
- `x-ratelimit-used`: requests made in current window
- `x-ratelimit-reset`: window reset time, UTC epoch seconds
- `x-ratelimit-resource`: which rate-limit resource the request counted against
- `retry-after`: seconds to wait before retrying (present on some secondary-limit responses)

## Exceeding limits

- Both primary and secondary limit violations return a **403 or 429** response.
- Primary exceeded: `x-ratelimit-remaining` is `0`; wait until `x-ratelimit-reset`.
- Secondary exceeded: honor `retry-after` if present; else if `x-ratelimit-remaining` is 0, wait until `x-ratelimit-reset`; otherwise wait at least one minute, then retry with exponentially increasing delays and give up after a bounded number of retries.
- "There is not a way to check the status of your secondary rate limit."

## Checking status

`GET /rate_limit` does not count against your primary REST rate limit (it can count against secondary limits). Prefer reading the `x-ratelimit-*` response headers of ordinary responses.
