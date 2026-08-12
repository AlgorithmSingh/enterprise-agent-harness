# Prototype artifacts

Throwaway design spikes. Decision/status control board: `../PLANS/PROTOTYPE-CHECKLIST.md`.

- `001-rate-limit-scheduler/` — stdlib-only spike proving the D07 scheduler contract (per-bucket limiters, utilization ceiling, AIMD + slow-start, full-jitter backoff, Retry-After precedence) is implementable and fake-clock testable.
- `002-mcp-headless-client/` — contract check of the `mcp` Python SDK surface and an offline in-process stdio round trip, validating the book's deterministic MCP client claims.

Prototype code is a design instrument, never production implementation.
