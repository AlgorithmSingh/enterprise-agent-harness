Source: https://cli.github.com/manual/gh_help_exit-codes
Accessed: 2026-08-12

# gh exit codes (manual)

- `0`: "If a command completes successfully, the exit code will be 0"
- `1`: "If a command fails for any reason, the exit code will be 1"
- `2`: "If a command is running but gets cancelled, the exit code will be 2"
- `4`: "If a command requires authentication, the exit code will be 4"

Caveat (verbatim): "It is possible that a particular command may have more exit codes, so it is a good practice to check documentation for the command if you are relying on exit codes to control some behavior."

Notes:
- No exit code 3 is documented. No dedicated exit code exists for rate-limit failures; HTTP-level failures (including 403/429 rate limits) fall under exit code 1.
