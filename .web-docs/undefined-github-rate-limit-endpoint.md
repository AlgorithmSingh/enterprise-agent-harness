Source: https://docs.github.com/en/rest/rate-limit/rate-limit
Accessed: 2026-08-12
Note: faithful extraction (quotes are verbatim from the page); not a full-page mirror.

# REST API endpoint for rate limits (GitHub Docs)

## GET /rate_limit

- "Accessing this endpoint does not count against your REST API rate limit." (The rate-limits overview page adds: it does not count against your primary rate limit, "but it can count against your secondary rate limit.")
- Headers used in examples: `Authorization: Bearer <TOKEN>`, `Accept: application/vnd.github+json`.
- Status codes: `200` OK, `304` Not modified, `404` Resource not found.

## Response schema

Top-level `resources` object with one rate-limit object per bucket:

| Bucket key | Meaning |
|---|---|
| `core` (required) | All non-search REST API resources |
| `search` (required) | Search endpoints, excluding code search |
| `code_search` | Code search (`GET /search/code`) |
| `graphql` | GraphQL API |
| `integration_manifest` | `POST /app-manifests/{code}/conversions` (GitHub App Manifest conversion) |
| `dependency_snapshots` | Dependency graph snapshot submissions |
| `dependency_sbom` | SBOM requests |
| `code_scanning_upload` | SARIF upload operations |
| `actions_runner_registration` | Self-hosted runner registration |
| `source_import` | "No longer in use for any API endpoints, and it will be removed" |

Each rate-limit object has integer fields:

- `limit` — total requests allowed in the window
- `remaining` — requests remaining
- `used` — requests consumed
- `reset` — epoch seconds (UTC) when the window resets

Deprecation: the top-level `rate` object "is closing down" — "use the core object instead."
