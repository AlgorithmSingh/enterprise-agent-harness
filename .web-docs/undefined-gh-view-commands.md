Sources (all accessed 2026-08-12):
- https://cli.github.com/manual/gh_pr_view
- https://cli.github.com/manual/gh_issue_view
- https://cli.github.com/manual/gh_run_view
- https://cli.github.com/manual/gh_release_view
- https://cli.github.com/manual/gh_repo_view

# gh pr view

Flags: --json <fields>, -q/--jq, -t/--template, -c/--comments, -w/--web.
JSON fields: same set as gh pr list (additions ... url), including statusCheckRollup, reviewDecision, mergeStateStatus, mergeable, files, commits, latestReviews.

# gh issue view

Flags: --json, -q/--jq, -t/--template, -c/--comments, -w/--web, -R/--repo.
JSON fields: assignees, author, blockedBy, blocking, body, closed, closedAt, closedByPullRequestsReferences, comments, createdAt, id, isPinned, issueType, labels, milestone, number, parent, projectCards, projectItems, reactionGroups, state, stateReason, subIssues, subIssuesSummary, title, updatedAt, url

# gh run view

Flags: --json, -q/--jq, -t/--template, --log, --log-failed, -j/--job <string>, -a/--attempt <uint>, --exit-status ("Exit with non-zero status if run failed"), -w/--web, -R/--repo.
JSON fields: attempt, conclusion, createdAt, databaseId, displayTitle, event, headBranch, headSha, jobs, name, number, startedAt, status, updatedAt, url, workflowDatabaseId, workflowName
(Note: `jobs` is available on run view but not run list.)

# gh release view

Flags: --json, -q/--jq, -t/--template, -w/--web, -R/--repo.
JSON fields: apiUrl, assets, author, body, createdAt, databaseId, id, isDraft, isImmutable, isPrerelease, name, publishedAt, tagName, tarballUrl, targetCommitish, uploadUrl, url, zipballUrl

# gh repo view

Flags: --json, -q/--jq, -t/--template, -b/--branch, -w/--web.
JSON fields: archivedAt, assignableUsers, codeOfConduct, contactLinks, createdAt, defaultBranchRef, deleteBranchOnMerge, description, diskUsage, forkCount, fundingLinks, hasDiscussionsEnabled, hasIssuesEnabled, hasProjectsEnabled, hasWikiEnabled, homepageUrl, id, isArchived, isBlankIssuesEnabled, isEmpty, isFork, isInOrganization, isMirror, isPrivate, isSecurityPolicyEnabled, isTemplate, isUserConfigurationRepository, issueTemplates, issues, labels, languages, latestRelease, licenseInfo, mentionableUsers, mergeCommitAllowed, milestones, mirrorUrl, name, nameWithOwner, openGraphImageUrl, owner, parent, primaryLanguage, projects, projectsV2, pullRequestTemplates, pullRequests, pushedAt, rebaseMergeAllowed, repositoryTopics, securityPolicyUrl, squashMergeAllowed, sshUrl, stargazerCount, templateRepository, updatedAt, url, usesCustomOpenGraphImage, viewerCanAdminister, viewerDefaultCommitEmail, viewerDefaultMergeMethod, viewerHasStarred, viewerPermission, viewerPossibleCommitEmails, viewerSubscription, visibility, watchers
