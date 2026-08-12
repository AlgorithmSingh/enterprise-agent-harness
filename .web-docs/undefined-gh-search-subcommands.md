Sources (all accessed 2026-08-12):
- https://cli.github.com/manual/gh_search_repos
- https://cli.github.com/manual/gh_search_issues
- https://cli.github.com/manual/gh_search_code
- https://cli.github.com/manual/gh_search_commits

# gh search repos

- `-L`, `--limit`: default 30 ("Maximum number of repositories to fetch")
- `--sort`: default "best-match"; options: forks, help-wanted-issues, stars, updated
- `--order`: default "desc"; asc|desc (ignored unless --sort set)
- `--json <fields>`, `-q`/`--jq <expr>`, `-t`/`--template <string>`
- JSON fields: createdAt, defaultBranch, description, forksCount, fullName, hasDownloads, hasIssues, hasPages, hasProjects, hasWiki, homepage, id, isArchived, isDisabled, isFork, isPrivate, language, license, name, openIssuesCount, owner, pushedAt, size, stargazersCount, updatedAt, url, visibility, watchersCount
- Qualifier flags: --archived, --created, --followers, --forks, --good-first-issues, --help-wanted-issues, --language, --license, --owner, --stars, --topic, --updated, --visibility, --size, --match, --number-topics, -w/--web

# gh search issues

- `-L`, `--limit`: default 30
- `--sort`: default "best-match"; options: comments, created, interactions, reactions, reactions-+1, reactions--1, reactions-heart, reactions-smile, reactions-tada, reactions-thinking_face, updated
- `--order`: default "desc"
- `--json` fields: assignees, author, authorAssociation, body, closedAt, commentsCount, createdAt, id, isLocked, isPullRequest, labels, number, repository, state, title, updatedAt, url
- Filter flags: --app, --archived, --assignee, --author, --closed, --commenter, --comments, --created, --include-prs, --interactions, --involves, --label, --language, --locked, --match, --mentions, --milestone, --no-assignee, --no-label, --no-milestone, --no-project, --owner, --project, --reactions, -R/--repo, --state, --team-mentions, --updated, --visibility, -w/--web
- (`gh search prs` shares this shape with PR-specific extras.)

# gh search code

- `-L`, `--limit`: default 30 ("Maximum number of code results to fetch")
- Filters: --extension, --filename, --language, --owner, -R/--repo, --size (KB range), --match {file|path}
- `--json` fields: path, repository, sha, textMatches, url
- `-q`/`--jq`, `-t`/`--template`, `-w`/`--web`
- Manual note: results "are powered by what is now a legacy GitHub code search engine"; results may differ from github.com code search UI and newer features such as regex search are not available via the API.

# gh search commits

- `-L`, `--limit`: default 30 ("Maximum number of commits to fetch")
- `--sort`: default best-match; options: author-date, committer-date
- `--order`: default desc
- `--json` fields: author, commit, committer, id, parents, repository, sha, url
- Filters: --author, --author-name, --author-email, --author-date, --committer, --committer-name, --committer-email, --committer-date, --hash, --parent, --tree, --merge, -R/--repo, --owner, --visibility

# Limit validation (from source, https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/search/repos/repos.go and .../shared/shared.go, accessed 2026-08-12)

- `SearchMaxResults = 1000` (constant, comment referencing GitHub search API limitation)
- Validation: `if opts.Query.Limit < 1 || opts.Query.Limit > shared.SearchMaxResults { return cmdutil.FlagErrorf("`--limit` must be between 1 and 1000") }`
