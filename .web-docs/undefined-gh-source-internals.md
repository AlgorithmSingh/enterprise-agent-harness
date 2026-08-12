Sources (all accessed 2026-08-12, trunk branch — source-code evidence, not manual pages):
- https://raw.githubusercontent.com/cli/go-gh/trunk/pkg/api/cache.go
- https://raw.githubusercontent.com/cli/go-gh/trunk/pkg/config/config.go
- https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/api/api.go
- https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/api/pagination.go
- https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/search/repos/repos.go
Secondary discussion evidence:
- https://github.com/cli/cli/discussions/7754 (Ways to handle rate limiting)
- https://github.com/cli/cli/issues/12812 (stale cached rate-limit headers after GraphQL limit reset)

# gh response cache (go-gh pkg/api/cache.go)

- Cacheable requests: method GET or HEAD, plus POST to `/graphql` or paths ending in `/api/graphql`.
- Cacheable responses: `res.StatusCode < 500 && res.StatusCode != 403` — i.e. 2xx, 3xx, and 4xx-except-403 responses ARE cached; 403 and 5xx are not.
- Cache key: SHA-256 over request method, full URL, Accept header, Authorization header, and request body.

# Cache directory (go-gh pkg/config/config.go)

Cache path precedence: `XDG_CACHE_HOME/gh`; `LocalAppData\GitHub CLI` (Windows only); `~/.cache/gh`; legacy fallback `os.TempDir()/gh-cli-cache`.
Config path precedence: `GH_CONFIG_DIR`; `XDG_CONFIG_HOME/gh`; `AppData\GitHub CLI` (Windows only); `~/.config/gh`.

# gh api error handling (cli/cli pkg/cmd/api/api.go)

- Error parsing runs when the response is JSON and (`RequestPath == "graphql"` OR `resp.StatusCode >= 400`). It extracts `message` (and GraphQL `errors`) from the body; the GraphQL case applies even at HTTP 200.
- On 4xx/5xx with a JSON `message`: stderr gets `gh: <message> (HTTP <status>)`.
- If no message parsed and status > 299: `serverError = fmt.Sprintf("HTTP %d", resp.StatusCode)`.
- When serverError is set: stderr gets `gh: %s\n`, plus optional scopes suggestion (`api.ScopesSuggestion`) and SSO URL; the command returns `cmdutil.SilentError` (exit code 1).
- The response body is still streamed to stdout (bodyWriter) unless `--silent` (bodyWriter = io.Discard).
- NO retry logic anywhere in the command: each request is made exactly once per pagination step.
- `--paginate`: loop terminates immediately on transport error; pages already emitted remain on stdout (partial output possible).
- `--slurp` wraps paginated JSON pages in a single outer array via jsonArrayWriter.

# gh api pagination (cli/cli pkg/cmd/api/pagination.go)

- REST next page: parses the `Link` response header with regex `<([^>]+)>;\s*rel="([^"]+)"` and follows `rel="next"`.
- `addPerPage` injects `per_page=100` into the request path when `--paginate` is used and `per_page` is not already specified (in path or params).
- GraphQL: `findEndCursor` scans the JSON for `pageInfo` and reads `endCursor` / `hasNextPage`; next request re-runs the query with the `endCursor` variable.
- No sleep/delay/backoff between pages.

# gh search limit validation (cli/cli pkg/cmd/search/...)

- `shared.SearchMaxResults = 1000`.
- Flag definition: `cmd.Flags().IntVarP(&opts.Query.Limit, "limit", "L", 30, "Maximum number of repositories to fetch")`.
- Validation: limit must be between 1 and 1000, else `cmdutil.FlagErrorf`.

# Retry/throttle behavior

gh has no built-in retry or client-side throttling for rate limits (confirmed by absence in api.go source; corroborated by cli/cli discussion #7754 and open feature requests such as cli/cli#9586). Callers must implement their own backoff.
