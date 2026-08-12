Source: https://cli.github.com/manual/gh_help_environment
Accessed: 2026-08-12

# gh environment variables (manual)

Authentication:
- `GH_TOKEN`, `GITHUB_TOKEN` (in order of precedence): "an authentication token that will be used when a command targets either `github.com` or a subdomain of `ghe.com`". GH_TOKEN takes precedence over GITHUB_TOKEN.
- `GH_ENTERPRISE_TOKEN`, `GITHUB_ENTERPRISE_TOKEN` (in order of precedence): token used when a command targets a GitHub Enterprise Server host.

Host and repository:
- `GH_HOST`: "specify the GitHub hostname for commands where a hostname has not been provided, or cannot be inferred from the context of a local Git repository".
- `GH_REPO`: "specify the GitHub repository in the `[HOST/]OWNER/REPO` format for commands that otherwise operate on a local repository".

Editor / browser / pager:
- `GH_EDITOR`, `GIT_EDITOR`, `VISUAL`, `EDITOR` (in order of precedence): editor for authoring text.
- `GH_BROWSER`, `BROWSER` (in order of precedence): web browser for opening links.
- `GH_PAGER`, `PAGER` (in order of precedence): "a terminal paging program to send standard output to, e.g. `less`".

Debug and output:
- `GH_DEBUG`: "set to a truthy value to enable verbose output on standard error. Set to `api` to additionally log details of HTTP traffic."
- `GLAMOUR_STYLE`: style for rendering Markdown.
- `NO_COLOR`: "set to any value to avoid printing ANSI escape sequences for color output."
- `CLICOLOR`: "set to `0` to disable printing ANSI colors in output."
- `CLICOLOR_FORCE`: set to a value other than `0` to keep ANSI colors even when piped.
- `GH_COLOR_LABELS`: display labels using RGB hex color codes in truecolor terminals.
- `GH_ACCESSIBLE_COLORS`: truthy value enables customizable 4-bit accessible colors.
- `GH_FORCE_TTY`: set to any value to force terminal-style output even when output is redirected.
- `GH_MDWIDTH`: default maximum width for markdown render wrapping.
- `GH_SPINNER_DISABLED`: replace spinner animation with textual progress indicator.
- `GH_ACCESSIBLE_PROMPTER`: prompts compatible with screen readers.

Prompting / updates:
- `GH_PROMPT_DISABLED`: "set to any value to disable interactive prompting in the terminal."
- `GH_NO_UPDATE_NOTIFIER`: "set to any value to disable GitHub CLI update notifications. When any command is executed, gh checks for new versions once every 24 hours."
- `GH_NO_EXTENSION_UPDATE_NOTIFIER`: disable extension update notifications.

Config / misc:
- `GH_CONFIG_DIR`: directory where gh stores configuration files.
- `GH_PATH`: path to the gh executable.
- `GH_TELEMETRY`: set to `log` to print telemetry data to standard error; disable with `false` or `0`.
- `DO_NOT_TRACK`: set to `true` or `1` to disable telemetry.
