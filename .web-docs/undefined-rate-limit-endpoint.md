Source: https://docs.github.com/en/rest/rate-limit/rate-limit
Accessed: 2026-08-12

# GET /rate_limit

- Endpoint: `GET /rate_limit`
- "Accessing this endpoint does not count against your REST API rate limit."
- Each resource object contains `limit`, `remaining`, `used`, `reset`.

Resource objects in the response:

| Resource | Covers |
|---|---|
| core | All non-search REST API resources |
| search | REST search (excluding code search) |
| code_search | REST code search |
| graphql | GraphQL API |
| integration_manifest | POST /app-manifests/{code}/conversions |
| dependency_snapshots | Dependency-graph snapshot submission |
| dependency_sbom | Dependency-graph SBOM requests |
| code_scanning_upload | SARIF upload |
| actions_runner_registration | Self-hosted runner registration |
| source_import | Deprecated / no longer in use |
| scim | SCIM API |
| code_scanning_autofix | Code scanning autofix |
| copilot_usage_records | Copilot usage tracking |
