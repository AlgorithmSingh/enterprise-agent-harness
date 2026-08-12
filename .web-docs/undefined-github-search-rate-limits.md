Source: https://docs.github.com/en/rest/search/search
Accessed: 2026-08-12
Note: faithful extraction of the search-endpoint rate-limit and constraint content (quotes are verbatim from the page); not a full-page mirror.

# REST API endpoints for search (GitHub Docs) — rate limits and constraints

## Custom search rate limit (separate from the core REST limit)

- Authenticated: "up to 30 requests per minute for all search endpoints except for the Search code endpoint."
- Code search (`GET /search/code`): requires authentication; "10 requests per minute."
- Unauthenticated: "up to 10 requests per minute" for all search endpoints.
- Semantic/hybrid search for issues: requires authentication; "rate limited to 10 requests per minute."

## Result constraints

- "up to 1,000 results for each search" (maximum results a search can return).
- Repository search scope: "find up to 4,000 repositories that match your filters."
- `per_page` maximum: 100 results per page (most endpoints default to 30).

## Timeouts

- Queries that exceed the time limit return partial results with `incomplete_results: true`.
- "Reaching a timeout does not necessarily mean that search results are incomplete."

## Search endpoint paths

- `GET /search/code`
- `GET /search/commits`
- `GET /search/issues`
- `GET /search/labels`
- `GET /search/repositories`
- `GET /search/topics`
- `GET /search/users`
