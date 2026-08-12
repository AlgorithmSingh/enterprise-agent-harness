---
type: reference
title: "gh CLI as a Deterministic Retrieval Tool"
description: "Verified reference for scripting gh (api, search, list/view) as a machine-readable GitHub retrieval backend: flags, pagination, caching, exit codes, rate limits, and failure semantics for a rate-limit-aware scheduler."
timestamp: "2026-08-12"
---

# gh CLI as a Deterministic Retrieval Tool

All facts below were verified on 2026-08-12 against the official gh manual (cli.github.com/manual), GitHub REST/GraphQL docs (docs.github.com), or the `cli/cli` and `cli/go-gh` source (trunk). Source-code-derived facts are labeled as such.

## Overview

`gh` is GitHub's official CLI. Three of its surfaces are suitable for deterministic, scripted retrieval:

1. **`gh api`** — a thin authenticated HTTP client over the REST (v3) and GraphQL (v4) APIs. Raw JSON passthrough, built-in pagination, built-in jq, optional response caching. This is the preferred surface for a scheduler: output bytes are the API's own JSON.
2. **`gh search <code|commits|issues|prs|repos>`** — wrappers over the REST search API with `--json` output.
3. **`gh <pr|issue|run|release|repo> list|view --json ...`** — typed wrappers (mostly GraphQL-backed) with stable, discoverable JSON field sets.

Critical property for scheduler design: **gh performs no retries and no client-side throttling** — each HTTP request is made exactly once, including during `--paginate` loops (verified in `cli/cli` `pkg/cmd/api/api.go`; corroborated by cli/cli discussion #7754). The scheduler must own all budgeting, backoff, and retry logic.

Determinism prelude for every scripted invocation:

```sh
export GH_PROMPT_DISABLED=1 GH_PAGER=cat NO_COLOR=1 GH_NO_UPDATE_NOTIFIER=1
```

## Authentication

From `gh help environment` (manual, accessed 2026-08-12):

| Variable | Meaning |
|---|---|
| `GH_TOKEN`, `GITHUB_TOKEN` (in order of precedence) | Auth token used when a command targets `github.com` or a subdomain of `ghe.com` |
| `GH_ENTERPRISE_TOKEN`, `GITHUB_ENTERPRISE_TOKEN` (in order of precedence) | Auth token used when a command targets a GitHub Enterprise Server host |
| `GH_HOST` | GitHub hostname when none is provided or inferable from the local git repo |
| `GH_REPO` | Target repository as `[HOST/]OWNER/REPO` for commands that otherwise use the local repo; also feeds `{owner}`/`{repo}`/`{branch}` placeholders in `gh api` paths |

- With `GH_TOKEN` set, no interactive `gh auth login` is needed; this is the correct mode for a harness.
- `gh api --hostname <string>` overrides the hostname per request (default `github.com`).
- REST API version pinning: pass `-H "X-GitHub-Api-Version: 2022-11-28"`. Requests without the header default to version `2022-11-28`; supported versions as of 2026-08-12 are `2022-11-28` (end of support 2028-03-10) and `2026-03-10`. An unsupported version returns `410 Gone` (docs.github.com api-versions page).
- If authentication is entirely absent, gh exits with code `4` ("command requires authentication") before making requests. An *invalid* token surfaces as an HTTP 401 at request time → exit code `1`.

## Retrieval surface

### gh api flags (complete retrieval-relevant set, from the gh_api manual)

| Flag | Effect | Default |
|---|---|---|
| `-X`, `--method <string>` | HTTP method | `GET`; switches to `POST` if parameters are added |
| `-f`, `--raw-field <key=value>` | Static string body/query parameter | — |
| `-F`, `--field <key=value>` | Typed parameter: `true`/`false`/`null`, integers converted; `@file` reads file, `@-` reads stdin; placeholders substituted | — |
| `-H`, `--header <key:value>` | Add request header (e.g. `X-GitHub-Api-Version`) | — |
| `--input <file>` | Request body from file, `-` = stdin | — |
| `-q`, `--jq <string>` | Filter response with built-in jq (no jq binary needed) | — |
| `-t`, `--template <string>` | Format response with Go template | — |
| `--cache <duration>` | Cache the response, e.g. `3600s`, `60m`, `1h` | no cache |
| `--hostname <string>` | Target GitHub hostname | `github.com` |
| `-i`, `--include` | Prepend HTTP status line + response headers to output | off |
| `--silent` | Discard response body | off |
| `--verbose` | Include full HTTP request and response | off |
| `--paginate` | Sequentially fetch all pages | off |
| `--slurp` | With `--paginate`, wrap pages in one outer JSON array | off |
| `-p`, `--preview <strings>` | Opt into API previews | — |

Notes:
- With a GET method, `-f`/`-F` parameters become query-string parameters (manual example: `gh api -X GET search/issues -f q='repo:cli/cli is:open'`).
- Nested params: `key[subkey]=value`; arrays: `key[]=v1 key[]=v2`; empty array: `key[]`.
- `{owner}`, `{repo}`, `{branch}` placeholders resolve from the current directory's repo or `GH_REPO`.

### What --cache caches, and where (from cli/go-gh source, trunk)

- **Cacheable requests:** `GET`, `HEAD`, and `POST` to `/graphql` or paths ending `/api/graphql`. Other methods are never cached.
- **Cacheable responses:** `StatusCode < 500 && StatusCode != 403` — meaning **404s and other 4xx responses ARE cached** for the TTL; 403 (incl. rate-limit 403s) and 5xx are not. 429 is below 500 and not 403, so by this predicate it is cacheable (source-derived inference; flag: 429-caching **(unverified)** in practice).
- **Cache key:** SHA-256 of method + full URL + `Accept` header + `Authorization` header + request body. Different tokens therefore have distinct cache entries.
- **Location precedence:** `$XDG_CACHE_HOME/gh` → `LocalAppData\GitHub CLI` (Windows) → `~/.cache/gh` → legacy fallback `$TMPDIR/gh-cli-cache`.
- Clear the cache with `gh config clear-cache` ("Clear the cli cache", manual gh_config_clear-cache) or by deleting the cache directory; there is no documented per-entry purge.

### gh search commands

All five subcommands share: `-L`/`--limit` (default **30**, validated **1–1000**, error text `` `--limit` must be between 1 and 1000 ``; cap = `SearchMaxResults = 1000`, from cli/cli source), `--json <fields>`, `-q`/`--jq`, `-t`/`--template`, `-w`/`--web`. Negated qualifiers need `--` (Unix) / `--% … --` (PowerShell): `gh search issues -- "query -label:bug"`.

| Command | Sort options (default best-match) | `--json` fields |
|---|---|---|
| `gh search repos` | forks, help-wanted-issues, stars, updated; `--order` asc\|desc (default desc) | createdAt, defaultBranch, description, forksCount, fullName, hasDownloads, hasIssues, hasPages, hasProjects, hasWiki, homepage, id, isArchived, isDisabled, isFork, isPrivate, language, license, name, openIssuesCount, owner, pushedAt, size, stargazersCount, updatedAt, url, visibility, watchersCount |
| `gh search issues` (and `prs`) | comments, created, interactions, reactions(+variants), updated | assignees, author, authorAssociation, body, closedAt, commentsCount, createdAt, id, isLocked, isPullRequest, labels, number, repository, state, title, updatedAt, url |
| `gh search code` | (no sort flags) | path, repository, sha, textMatches, url |
| `gh search commits` | author-date, committer-date | author, commit, committer, id, parents, repository, sha, url |

Manual caveat for `gh search code`: results are served by "a legacy GitHub code search engine"; regex and other newer github.com code-search features are unavailable via the API.

Underlying REST endpoints: `GET /search/repositories`, `/search/code`, `/search/commits`, `/search/issues`, `/search/labels`, `/search/topics`, `/search/users`.

### gh list/view commands (typed, deterministic via --json)

`--json` with **no** argument exits with the full list of available fields for that command (gh formatting help) — use this for field discovery and drift detection.

| Command | `--limit` default | Other retrieval-relevant defaults | Notable `--json` fields |
|---|---|---|---|
| `gh pr list` | 30 | `--state` default `open` (open\|closed\|merged\|all); `-S/--search` | number, title, url, state, isDraft, headRefOid, mergeStateStatus, reviewDecision, statusCheckRollup, files, updatedAt (46-field set, same as `pr view`) |
| `gh issue list` | 30 | `--state` default `open` (open\|closed\|all); `-S/--search` | number, title, url, state, labels, updatedAt |
| `gh run list` | **20** | `-s/--status` (queued, completed, in_progress, requested, waiting, pending, action_required, cancelled, failure, neutral, skipped, stale, startup_failure, success, timed_out); `-w/--workflow`, `-b/--branch`, `-c/--commit`, `-e/--event`, `--created`, `-u/--user` | attempt, conclusion, createdAt, databaseId, displayTitle, event, headBranch, headSha, name, number, startedAt, status, updatedAt, url, workflowDatabaseId, workflowName |
| `gh run view` | — | `--job`, `--attempt`, `--log`, `--log-failed`, `--exit-status` (nonzero exit if run failed) | run-list fields **plus `jobs`** |
| `gh release list` | 30 | `-O/--order` default `desc`; `--exclude-drafts`, `--exclude-pre-releases` | createdAt, isDraft, isImmutable, isLatest, isPrerelease, name, publishedAt, tagName |
| `gh release view` | — | — | adds assets, apiUrl, tarballUrl, zipballUrl, targetCommitish, body, author |
| `gh repo list` | 30 | `--visibility` {public\|private\|internal}, `--fork`, `--source`, `--archived`, `--no-archived`, `--topic`, `-l/--language` | name, nameWithOwner, visibility, isFork, isArchived, stargazerCount, … |
| `gh repo view` | — | `-b/--branch` | defaultBranchRef, nameWithOwner, primaryLanguage, pushedAt, … (60+ fields) |

All of these accept `-R/--repo [HOST/]OWNER/REPO`, `--jq`, and `--template`. Template helpers available: `autocolor`, `color`, `hyperlink`, `join`, `pluck`, `tablerow`/`tablerender`, `timeago`, `timefmt`, `truncate`, plus Sprig's `contains`, `hasPrefix`, `hasSuffix`, `regexMatch`.

## Pagination

**REST via `gh api --paginate`** (cli/cli `pkg/cmd/api/pagination.go`, trunk):
- gh follows the `Link` response header, matching `<([^>]+)>;\s*rel="([^"]+)"` and requesting `rel="next"` until absent.
- gh injects `per_page=100` into the request when `--paginate` is set and `per_page` is not already specified.
- Pages are fetched **sequentially with no delay** between requests, one HTTP request per page, no retries.
- Output: pages are concatenated as emitted; `--slurp` wraps them in one outer JSON array (needed when each page is itself an array/object and you want a single valid JSON document). `--jq` runs per page unless `--slurp` collapses first **(unverified nuance — verify with a two-page probe before relying on it)**.

**GraphQL via `gh api graphql --paginate`** (gh_api manual):
- The query MUST declare `$endCursor: String` and select `pageInfo { hasNextPage endCursor }` on the paginated connection.
- gh re-executes the query, feeding `endCursor` back in, until `hasNextPage` is false (source: `findEndCursor` scans for `pageInfo`).
- Each page is emitted as a separate JSON document unless `--slurp` is used.
- GraphQL connections require `first`/`last` between 1 and 100; max 500,000 nodes per request (GraphQL docs).

**Search:** the REST search API returns at most 1,000 results per query, `per_page` max 100 (default 30). `gh search` subcommands paginate internally up to `--limit` (max 1,000).

**Wrapper commands:** `gh pr/issue/run/... list` paginate internally up to `--limit`; the defaults above (30, or 20 for `run list`) silently truncate — always pass `--limit` explicitly.

## Rate limits

All numbers from docs.github.com, accessed 2026-08-12 (REST rate-limits page, GraphQL rate-limits page, search API page).

### Primary limits

| Bucket | Limit |
|---|---|
| REST, unauthenticated | 60 requests/hour |
| REST, authenticated user (PAT / OAuth / App-on-behalf-of-user) | 5,000 requests/hour |
| REST, authenticated user on Enterprise Cloud (org-owned GitHub App or org-owned/approved OAuth app) | 15,000 requests/hour |
| REST, GitHub App installation | 5,000/hour base, +50/hour per repo >20 and per user >20, cap 12,500/hour; 15,000/hour for Enterprise Cloud org |
| REST, `GITHUB_TOKEN` in Actions | 1,000 requests/hour per repository (15,000 on Enterprise Cloud) |
| GraphQL, user token | 5,000 points/hour (10,000 if Enterprise Cloud org member) |
| GraphQL, App installation | 5,000 base → cap 12,500; 10,000 enterprise |
| GraphQL, `GITHUB_TOKEN` in Actions | 1,000 points/hour per repository |
| Search endpoints (authenticated) | 30 requests/minute |
| Code search endpoint (authenticated) | 10 requests/minute |
| Search (unauthenticated) | 10 requests/minute |

GraphQL point cost: (sum of requests needed per unique connection) ÷ 100, rounded, minimum 1.

### Secondary limits (shared REST + GraphQL)

| Constraint | Value |
|---|---|
| Concurrent requests | ≤ 100 |
| REST points/minute | ≤ 900 (GET/HEAD/OPTIONS = 1 pt; POST/PATCH/PUT/DELETE = 5 pt) |
| GraphQL points/minute | ≤ 2,000 (query = 1 pt; with mutations = 5 pt) |
| CPU time | ≤ 90 s CPU per 60 s real time (≤ 60 s of that for GraphQL) |
| Content-generating requests | ≤ 80/minute and ≤ 500/hour |

### Headers and error semantics

Response headers (exact names, lowercase as documented): `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-used`, `x-ratelimit-reset` (UTC epoch seconds), `x-ratelimit-resource`, and `retry-after` (seconds; present on some secondary-limit responses).

- Exceeding **either** primary or secondary limits yields a **403 or 429** — code alone does not distinguish them. Primary exhaustion is identified by `x-ratelimit-remaining: 0`; secondary violations typically arrive with `retry-after` and/or a body message containing "secondary rate limit" while `x-ratelimit-remaining` may be nonzero.
- Documented handling order: honor `retry-after` if present; else if `x-ratelimit-remaining` is 0, sleep until `x-ratelimit-reset`; else wait ≥ 60 s and back off exponentially with a bounded retry count.
- "There is not a way to check the status of your secondary rate limit."

### Observing budget cheaply

`GET /rate_limit` **does not count against the primary REST rate limit** (it can count against secondary limits). Retrieval-relevant resources in its response: `core`, `search`, `code_search`, `graphql` (each with `limit`, `remaining`, `used`, `reset`).

```sh
gh api rate_limit --jq '{core: .resources.core, search: .resources.search, code_search: .resources.code_search, graphql: .resources.graphql}'
```

Cheaper still: read `x-ratelimit-remaining`/`x-ratelimit-reset` off responses you were already making (`gh api -i …`, or `GH_DEBUG=api` on stderr).

## Deterministic retrieval recipes

```sh
# Prelude for every scripted call
export GH_PROMPT_DISABLED=1 GH_PAGER=cat NO_COLOR=1 GH_NO_UPDATE_NOTIFIER=1
export GH_TOKEN=***           # avoids keyring/interactive auth

# 1. Raw REST, version-pinned, minimal payload via jq
gh api -H "X-GitHub-Api-Version: 2022-11-28" \
  repos/{owner}/{repo}/releases --jq '.[].tag_name'

# 2. Full pagination into ONE valid JSON document (per_page=100 auto-injected)
gh api --paginate --slurp repos/{owner}/{repo}/issues > issues-pages.json

# 3. GraphQL cursor pagination (query MUST take $endCursor and select pageInfo)
gh api graphql --paginate --slurp -F owner='{owner}' -F name='{repo}' -f query='
  query($owner:String!,$name:String!,$endCursor:String){
    repository(owner:$owner,name:$name){
      issues(first:100, after:$endCursor){
        nodes{ number title }
        pageInfo{ hasNextPage endCursor }
      }
    }
  }'

# 4. Cached metadata read (1h TTL; cached under ~/.cache/gh; key includes token+URL)
gh api --cache 1h repos/{owner}/{repo} --jq .default_branch

# 5. Typed listings — always pass --limit; defaults truncate (30, run list: 20)
gh pr list -R OWNER/REPO --state all --limit 200 \
  --json number,title,state,updatedAt,url
gh run list -R OWNER/REPO --limit 100 \
  --json databaseId,status,conclusion,headSha,workflowName,createdAt
gh run view -R OWNER/REPO <run-id> --json status,conclusion,jobs

# 6. Search (30 req/min bucket; code search 10 req/min; hard 1000-result cap)
gh search repos --owner OWNER --limit 100 --json fullName,stargazersCount,pushedAt
gh search code 'needle' --repo OWNER/REPO --limit 50 --json path,repository,url

# 7. Field discovery / schema drift probe (exits nonzero, prints field list)
gh pr list --json 2>&1 | sort > pr-list-fields.txt

# 8. Budget check that costs zero primary-REST quota
gh api rate_limit --jq '.resources | {core: .core.remaining, search: .search.remaining, graphql: .graphql.remaining}'

# 9. Headers for one response (status line + headers precede body)
gh api -i repos/{owner}/{repo} | sed -n '1,20p'
```

## Scheduler implications

Hard constraints a rate-limit-aware parallel scheduler must respect for the gh backend:

- **gh never retries and never throttles.** One HTTP request per call/page, no sleeps, no backoff (verified in source). The scheduler owns 100% of retry/backoff/budget logic.
- **Budget buckets are per token, per resource**: `core` (5,000/hr user; 1,000/hr Actions `GITHUB_TOKEN` per repo), `search` (30/min), `code_search` (10/min), `graphql` (5,000 pts/hr). Track them independently; a search-bucket 403 says nothing about core budget.
- **Concurrency cap: ≤ 100 concurrent requests per token** (REST+GraphQL combined, secondary limit). Stay far below it; also respect ≤ 900 REST points/min and ≤ 2,000 GraphQL points/min. For GET-only retrieval, 900 pts/min = 900 requests/min ceiling.
- **`--paginate` is a burst**: N pages = N sequential requests with zero inter-page delay, all charged to the same bucket. Budget a paginated call as ceil(expected_items/100) requests, not 1.
- **Defaults truncate silently**: `--limit` defaults are 30 (20 for `gh run list`); search caps at 1,000 results ever. Plans needing completeness must use `gh api --paginate` (REST) or cursor GraphQL, not `gh search`.
- **403/429 must be disambiguated by headers/body, not status code**: primary ⇒ `x-ratelimit-remaining: 0`, sleep until `x-ratelimit-reset`; secondary ⇒ honor `retry-after`, else ≥ 60 s exponential backoff. Secondary budget is unobservable — leave headroom.
- **Exit codes carry no rate-limit signal**: rate-limited calls exit 1 like any other failure; the scheduler must parse stderr (`gh: API rate limit exceeded …`, `gh: … secondary rate limit …`) or run with `-i`/`GH_DEBUG=api` to see headers.
- **`--cache` is a real lever but caches 4xx too**: 404s persist for the TTL (403s and 5xx are never cached). Use generous TTLs for immutable data (commits, closed PRs), zero for liveness checks; remember the cache key includes the token.
- **Serialize writes; parallelize reads**: content-creating requests are capped at 80/min, 500/hr, and GitHub explicitly advises against concurrent writes — retrieval-only scheduling avoids this class entirely.
- **Poll budget cheaply**: `GET /rate_limit` is free against the primary REST limit — safe to poll each scheduling tick, but do not spam it (it can count against secondary limits).
- **Pin `X-GitHub-Api-Version: 2022-11-28`** on `gh api` REST calls so payload shapes cannot drift when GitHub promotes a new default version (a newer version `2026-03-10` already exists).

## Failure modes and healing signals

| Failure | On the wire | gh behavior | Healing action |
|---|---|---|---|
| No credentials at all | (no request made) | Exit **4** ("command requires authentication") | Set `GH_TOKEN`; do not retry without it |
| Bad/expired token | HTTP 401, JSON body with `message` | Body → stdout; `gh: <message> (HTTP 401)` → stderr; exit **1** | Rotate token; do not back off (not a rate issue) |
| Primary rate limit exhausted | 403 or 429; `x-ratelimit-remaining: 0`; body `message` mentions "API rate limit exceeded" | stderr `gh: …`; exit **1**; response NOT cached (403) | Sleep until `x-ratelimit-reset` (epoch s), then retry once |
| Secondary rate limit | 403 or 429; often `retry-after`; body mentions "secondary rate limit" | Same as above; exit **1** | Honor `retry-after`; else ≥ 60 s exponential backoff; reduce concurrency |
| Missing scope / SSO required | 403 with scope/SSO hints | stderr adds scopes suggestion and SSO authorization URL (source: `api.ScopesSuggestion`) | Escalate to operator — not retryable |
| Not found / gone | 404 / 410 | Body → stdout, `gh: <message> (HTTP 404)` → stderr, exit **1**; **404 IS cached** if `--cache` used | Verify path/permissions; clear the gh cache (`gh config clear-cache`) before retrying a `--cache` call |
| Unsupported `X-GitHub-Api-Version` | **410 Gone** | exit **1** | Fix the pinned version string |
| Search query invalid (>256 chars, >5 AND/OR/NOT) | 422 "Validation failed" | exit **1** | Rewrite query; not retryable |
| Search timeout | 200 with `incomplete_results: true` | Exit **0** — looks like success | Treat `incomplete_results` as partial data; narrow the query and re-run |
| GraphQL errors in a 200 | HTTP 200, body has `errors[]` | gh parses GraphQL bodies for errors even at 200: `gh: <message>` → stderr, exit **1** (source: api.go) | Inspect message: rate-limit-typed errors → back off; schema errors → fix query |
| Mid-`--paginate` transport failure | pages 1..k−1 already fetched | Loop aborts; partial pages already on stdout; exit nonzero | Discard partial output (or dedupe on re-run); restart the whole paginated call |
| 5xx / network blip | 502/503/504 or connection error | No retry; exit **1**; 5xx never cached | Retry with jittered backoff (safe for GET) |
| Stale cached rate-limit state after GraphQL exhaustion | — | `gh issue list`-style commands may keep failing after reset due to cached responses (cli/cli issue #12812 — secondary source, open bug) | Run `gh config clear-cache` (or delete the gh cache dir, e.g. `~/.cache/gh` or legacy `$TMPDIR/gh-cli-cache`) |

Stderr is the machine-readable error channel (`gh: …` prefix); stdout remains pure API payload (error bodies included, unless `--silent`). `GH_DEBUG=api` adds full HTTP traffic on stderr without contaminating stdout.

## Sources

All accessed 2026-08-12.

| URL | Grounded |
|---|---|
| https://cli.github.com/manual/gh_api | gh api flags, placeholders, GraphQL pagination contract, cache flag syntax |
| https://cli.github.com/manual/gh_help_environment | GH_TOKEN/GITHUB_TOKEN precedence, GH_HOST, GH_REPO, GH_PAGER, NO_COLOR, CLICOLOR, GH_PROMPT_DISABLED, GH_NO_UPDATE_NOTIFIER (24 h check), GH_DEBUG=api |
| https://cli.github.com/manual/gh_help_exit-codes | Exit codes 0/1/2/4; no rate-limit-specific code |
| https://cli.github.com/manual/gh_search | Subcommand list, `--` negative-qualifier syntax |
| https://cli.github.com/manual/gh_search_repos, …_issues, …_code, …_commits | Per-command flags, --limit default 30, --json field sets, legacy code-search caveat |
| https://cli.github.com/manual/gh_help_formatting | --json/--jq/--template semantics, built-in jq, field discovery, template functions |
| https://cli.github.com/manual/gh_config_clear-cache | `gh config clear-cache` ("Clear the cli cache") |
| https://cli.github.com/manual/gh_pr_list, gh_issue_list, gh_run_list, gh_release_list, gh_repo_list | Defaults (30 / run list 20; states), full JSON field lists |
| https://cli.github.com/manual/gh_pr_view, gh_issue_view, gh_run_view, gh_release_view, gh_repo_view | View-command JSON fields incl. run view `jobs`, `--exit-status`, `--log-failed` |
| https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api | All primary/secondary REST numbers, x-ratelimit-* header names, 403-vs-429 and retry-after semantics |
| https://docs.github.com/en/rest/search/search | 30/min & 10/min search limits, 1,000-result cap, per_page 100, 256-char/5-operator query limits, incomplete_results |
| https://docs.github.com/en/rest/about-the-rest-api/api-versions | X-GitHub-Api-Version, default 2022-11-28, versions list, 410 Gone |
| https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api | GraphQL points/hour table, point formula, first/last 1–100, 500,000-node cap |
| https://docs.github.com/en/rest/rate-limit/rate-limit | GET /rate_limit free of primary limit; resource bucket names (core, search, code_search, graphql, …) |
| https://raw.githubusercontent.com/cli/go-gh/trunk/pkg/api/cache.go (source) | Cacheable methods; `<500 && !=403` response predicate; SHA-256 cache key incl. Authorization |
| https://raw.githubusercontent.com/cli/go-gh/trunk/pkg/config/config.go (source) | Cache dir precedence (XDG_CACHE_HOME/gh → ~/.cache/gh → $TMPDIR/gh-cli-cache) |
| https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/api/api.go (source) | No retry logic; error body → stdout + `gh: <msg> (HTTP n)` → stderr + SilentError (exit 1); GraphQL errors detected at HTTP 200; --slurp/--silent mechanics; pagination abort on error |
| https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/api/pagination.go (source) | Link-header rel="next" regex; per_page=100 injection; endCursor extraction; no inter-page delay |
| https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/search/repos/repos.go and …/shared/shared.go (source) | SearchMaxResults=1000; `--limit` 1–1000 validation and error text |
| https://github.com/cli/cli/discussions/7754 (secondary) | Corroborates absence of built-in rate-limit handling |
| https://github.com/cli/cli/issues/12812 (secondary, open bug) | Stale cached rate-limit state after GraphQL reset |
