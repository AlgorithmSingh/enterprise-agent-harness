Source: https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api
Accessed: 2026-08-12

# GitHub GraphQL API rate and node limits

Primary rate limits (points/hour):

| Token type | Limit |
|---|---|
| User (PAT, OAuth, GitHub App on behalf of user) | 5,000 |
| User who is Enterprise Cloud org member | 10,000 |
| GitHub App installation (non-enterprise) | 5,000 base, +50/repo above 20 and +50/user above 20, max 12,500 |
| GitHub App installation (enterprise org) | 10,000 |
| OAuth app | 5,000 (10,000 enterprise-owned) |
| GITHUB_TOKEN in Actions | 1,000 per repository (15,000 for enterprise resources) |

Point cost: sum the requests needed to fulfill each unique connection in the query, divide by 100, round; minimum cost 1 point. (Example: 5,101 internal requests -> 51 points.)

Check cost/budget in-query: `query { rateLimit { limit cost remaining resetAt } }`. Docs recommend using rate-limit response headers where possible instead of querying.

Node limits:
- All connections must supply `first` or `last`, which must be within 1-100.
- Maximum 500,000 total nodes per request.

Secondary limits (shared with REST): 100 concurrent requests; 2,000 GraphQL points/minute; 90 s CPU per 60 s real time (max 60 s CPU for GraphQL); content creation 80/min and 500/hour.
