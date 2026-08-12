Source: https://cli.github.com/manual/gh_search
Accessed: 2026-08-12

# gh search (manual)

"Search across all of GitHub."

Subcommands: `gh search code`, `gh search commits`, `gh search issues`, `gh search prs`, `gh search repos`.

Excluding results: prefix qualifiers with `-` (e.g. `-label:bug`). Because leading hyphens can be parsed as flags:
- Unix-like shells: put the query after a `--` separator: `gh search issues -- "my-search-query -label:bug"`
- PowerShell: combine the stop-parse token and separator: `gh --% search issues -- "my search query -label:bug"`
