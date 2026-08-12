Source: https://cli.github.com/manual/gh_help_formatting
Accessed: 2026-08-12

# gh formatting help (manual)

- Default output of gh commands is human-readable plain text; `--json` switches to machine-readable JSON.
- `--json` accepts a comma-separated list of fields. Invoked without field arguments, it prints the list of available field names for that command (useful for discovery).
- `--jq` filters JSON output using jq query syntax. "The `jq` utility does not need to be installed on the system to use this formatting directive" — a jq implementation is built into gh. Output is pretty-printed when connected to a terminal.
- `--template` formats JSON output using Go template syntax.

Custom template functions:
- `autocolor`: colorize only when output is a terminal
- `color <style> <input>`: colorize with ANSI styles
- `hyperlink <url> <text>`: terminal hyperlink
- `join <sep> <list>`
- `pluck <field> <list>`
- `tablerow <fields>...` and `tablerender`: aligned table output
- `timeago <time>`: relative timestamps
- `timefmt <format> <time>`: Go time-format timestamps
- `truncate <length> <input>`

Also available (from Sprig): `contains`, `hasPrefix`, `hasSuffix`, `regexMatch`.
