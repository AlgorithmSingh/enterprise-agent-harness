# Datadog API — Rate limits

- Source URL: https://docs.datadoghq.com/api/latest/rate-limits/
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch).

## Response headers (exact names and semantics)

| Header | Meaning (quoted) |
|---|---|
| `X-RateLimit-Limit` | "number of requests allowed in a time period" |
| `X-RateLimit-Period` | "length of time in seconds for resets (calendar aligned)" |
| `X-RateLimit-Remaining` | "number of allowed requests left in the current time period" |
| `X-RateLimit-Reset` | "time in seconds until next reset" |
| `X-RateLimit-Name` | "name of the rate limit for increase requests" |

NOTE: `X-RateLimit-Reset` is a RELATIVE delta in seconds (unlike GitHub's epoch-seconds `x-ratelimit-reset`).

## Status code

HTTP **429** when a rate limit is exceeded.

## Published numbers

- Metrics: "Datadog does not rate limit on data point/metric submission."
- Logs: "The API for sending logs is not rate limited."
- Events: 250,000 events per minute per organization.
- Other endpoints: limits exist and are communicated only via the response headers; specific numbers are not publicly disclosed.

## Scope and adjustability

- Limits apply at the organization level.
- "Rate limits can be increased from the defaults by contacting the Datadog support team" (support ticket; `X-RateLimit-Name` identifies which limit to cite). "There is a maximum to how much a rate limit can be increased due to the SaaS nature of Datadog."
