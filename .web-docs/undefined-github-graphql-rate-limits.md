# GitHub GraphQL API — Rate limits and node limits

- Source URL: https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch).

## Primary rate limit (points per hour)

| Principal | Points/hour |
|---|---|
| Users | 5,000 per user |
| GitHub Enterprise Cloud users | 10,000 |
| GitHub App installation (non-Enterprise) | 5,000 per installation (with scaling bonuses) |
| GitHub App installation (Enterprise) | 10,000 per installation |
| OAuth apps | 5,000 (10,000 if owned by an Enterprise Cloud organization) |
| GitHub Actions `GITHUB_TOKEN` | 1,000 per hour per repository (15,000 for enterprise resources) |

## Point calculation

1. Sum the number of requests needed to fulfill each unique connection in the query, assuming every `first`/`last` limit is reached.
2. Divide by 100 and round to the nearest whole number.
3. "The minimum point value of a call to the GraphQL API is 1."

## Node limit

"Individual calls cannot request more than 500,000 total nodes."

## Checking status — the `rateLimit` object

Fields: `limit` (max points/hour), `remaining` (points left in window), `used` (points consumed), `resetAt` (when the window resets), `cost` (point cost of the current query).

The docs recommend: "When possible, you should use the rate limit response headers instead of querying the API to check your rate limit." (Whether querying `rateLimit` itself consumes points is not explicitly stated on the page.)
