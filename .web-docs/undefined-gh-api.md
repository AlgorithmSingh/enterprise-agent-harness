Source: https://cli.github.com/manual/gh_api
Accessed: 2026-08-12

# gh api (manual)

Syntax: `gh api <endpoint> [flags]` — "Makes an authenticated HTTP request to the GitHub API and prints the response."

Endpoints: GitHub API v3 (REST) paths, or `graphql` for the v4 GraphQL API.

Placeholder substitution: `{owner}`, `{repo}`, `{branch}` are replaced with values from the repository of the current directory or the `GH_REPO` environment variable. PowerShell users must quote values containing curly braces.

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-f`, `--raw-field <key=value>` | Add static string parameter to request payload | — |
| `-F`, `--field <key=value>` | Add typed parameter; converts `true`/`false`/`null`, integers, placeholders; `@filename` reads from file, `@-` from stdin | — |
| `-X`, `--method <string>` | HTTP request method | `GET` (`POST` if parameters are added) |
| `-H`, `--header <key:value>` | Add HTTP request header | — |
| `--input <file>` | Use file as request body; `-` for stdin | — |
| `-q`, `--jq <string>` | Query the response using jq syntax (built-in; jq binary not required) | — |
| `-t`, `--template <string>` | Format JSON output using a Go template | — |
| `--cache <duration>` | Cache the response, e.g. `3600s`, `60m`, `1h` | no cache |
| `-p`, `--preview <strings>` | Opt into API previews (omit the `-preview` suffix) | — |
| `--hostname <string>` | GitHub hostname for the request | `github.com` |
| `-i`, `--include` | Include HTTP status line and response headers in output | — |
| `--silent` | Do not print the response body | — |
| `--verbose` | Include full HTTP request and response in the output | — |
| `--allow-escape-sequences` | Allow terminal escape sequences in output | — |
| `--paginate` | Make additional requests to fetch all pages of results sequentially | — |
| `--slurp` | With `--paginate`, wrap all pages of output in an outer JSON array | — |

## Pagination

- REST: `--paginate` requests additional result pages until all are fetched.
- GraphQL: pagination requires that the original query accept an `$endCursor: String` variable and that it fetch `pageInfo{ hasNextPage, endCursor }`. Each page is output separately by default; `--slurp` combines pages into a single JSON array.

## Nested parameters

`key[subkey]=value` for nested objects; `key[]=v1 key[]=v2` for arrays; `key[]` alone for an empty array.

## Examples (from manual)

- `gh api repos/{owner}/{repo}/releases`
- `gh api repos/{owner}/{repo}/issues/123/comments -f body='Hi'`
- `gh api -X GET search/issues -f q='repo:cli/cli is:open'`
- `gh api graphql -F owner='{owner}' -f query='...'`
- `gh api graphql --paginate -f query='...'` (query must use `$endCursor` and `pageInfo`)
