Sources (all accessed 2026-08-12):
- https://cli.github.com/manual/gh_pr_list
- https://cli.github.com/manual/gh_issue_list
- https://cli.github.com/manual/gh_run_list
- https://cli.github.com/manual/gh_release_list
- https://cli.github.com/manual/gh_repo_list

# gh pr list

- `-L`/`--limit`: default 30. `-s`/`--state`: default "open" {open|closed|merged|all}. `-S`/`--search <query>`.
- Filters: --app, -a/--assignee, -A/--author, -B/--base, -d/--draft, -H/--head, -l/--label. Inherited: -R/--repo [HOST/]OWNER/REPO.
- Output: --json <fields>, -q/--jq, -t/--template, -w/--web.
- JSON fields: additions, assignees, author, autoMergeRequest, baseRefName, baseRefOid, body, changedFiles, closed, closedAt, closingIssuesReferences, comments, commits, createdAt, deletions, files, fullDatabaseId, headRefName, headRefOid, headRepository, headRepositoryOwner, id, isCrossRepository, isDraft, labels, latestReviews, maintainerCanModify, mergeCommit, mergeStateStatus, mergeable, mergedAt, mergedBy, milestone, number, potentialMergeCommit, projectCards, projectItems, reactionGroups, reviewDecision, reviewRequests, reviews, state, statusCheckRollup, title, updatedAt, url

# gh issue list

- `-L`/`--limit`: default 30. `-s`/`--state`: default "open" {open|closed|all}. `-S`/`--search <query>`.
- Filters: --app, -a/--assignee, -A/--author, -l/--label, --mention, -m/--milestone, --type. Inherited: -R/--repo.
- Output: --json, -q/--jq, -t/--template, -w/--web. Alias: gh issue ls.

# gh run list

- `-L`/`--limit`: default 20.
- Filters: -a/--all (include disabled workflows), -b/--branch, -c/--commit <SHA>, --created <date>, -e/--event, -s/--status (queued, completed, in_progress, requested, waiting, pending, action_required, cancelled, failure, neutral, skipped, stale, startup_failure, success, timed_out), -u/--user, -w/--workflow. Inherited: -R/--repo.
- Output: --json, -q/--jq, -t/--template.
- JSON fields: attempt, conclusion, createdAt, databaseId, displayTitle, event, headBranch, headSha, name, number, startedAt, status, updatedAt, url, workflowDatabaseId, workflowName

# gh release list

- `-L`/`--limit`: default 30. `-O`/`--order`: default "desc" {asc|desc}.
- Filters: --exclude-drafts, --exclude-pre-releases. Inherited: -R/--repo.
- Output: --json, -q/--jq, -t/--template. Alias: gh release ls.
- JSON fields: createdAt, isDraft, isImmutable, isLatest, isPrerelease, name, publishedAt, tagName

# gh repo list

- Positional: `<owner>`. `-L`/`--limit`: default 30.
- Filters: --archived, --no-archived, --fork, --source, -l/--language, --topic, --visibility {public|private|internal}.
- Output: --json, -q/--jq, -t/--template. JSON fields include name, description, visibility, isFork, isArchived, stargazerCount and many more (run `gh repo list --json` with no fields to enumerate).
