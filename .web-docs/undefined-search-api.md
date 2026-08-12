Source: https://docs.github.com/en/rest/search/search
Accessed: 2026-08-12

# GitHub REST search API constraints

Rate limits:
- Authenticated: 30 requests/minute for search endpoints generally; 10 requests/minute for the code-search endpoint; 10 requests/minute for semantic/hybrid issue search.
- Unauthenticated: 10 requests/minute across search endpoints.

Result limits:
- Maximum 1,000 total results per search query.
- `per_page` maximum 100; default 30.

Query limits:
- Queries longer than 256 characters (not counting operators or qualifiers) are not supported.
- No more than five AND, OR, or NOT operators per query.
- Exceeding these returns a "Validation failed" error.

Timeouts:
- On timeout the API "returns the matches that were already found prior to the timeout, and the response has the `incomplete_results` property set to `true`."

Endpoints:
- GET /search/code
- GET /search/commits
- GET /search/issues
- GET /search/labels
- GET /search/repositories
- GET /search/topics
- GET /search/users

Text-match metadata: send `Accept: application/vnd.github.text-match+json` to receive match fragments/positions.
