# Documentation log

## 2026-08-12

- Added `simulate.md` — the tabletop simulation report: rendered-prompt grounding, the 183-test deterministic evidence, the 15 adversarial-trace findings (0 blocking), the repairs applied, and the documented setup prerequisites. Amended `operator-quick-reference.md` (stale-lock recovery bullet, accurate BR two-attempt refusal wording) and scoped the Git-visibility rule in the shared rules and `AGENTS.md` to canonical prompts and durable documentation.

- Corrected `book/mcp-client-mechanics.md` and `book/atlassian-rovo-mcp.md` from prototype evidence (`.prototype/002-mcp-headless-client/`): reference-server `tools/call` failures all surface as `isError` with silently-ignored unknown arguments (client-side `inputSchema` validation required), the mcp-remote OAuth callback port is derived from the server URL (39570 for authv2, not the documented 3334), token/debug paths are version-scoped, and the Python pin tightened to `mcp>=1.29,<2` with the v2 incompatibility renames recorded.
- Corrected `book/adaptive-scheduling.md` from prototype evidence (`.prototype/001-rate-limit-scheduler/`): the header-driven pacing formula now enforces the utilization ceiling as a per-window dispatch allowance against the bucket's limit (the previous remaining-derived rate silently integrated to ~99% of budget), and the slow-start section now keeps the cut factor, recovery floor, and slow-start ceiling (`ssthresh`) distinct. `repository-wide-agent-rules.md` and `workflow-and-gate-sequence.md` updated to match, including Retry-After-as-minimum wording.

- Created the repository as a domain port of the ADK/LangGraph agent-harness family for enterprise retrieval agent systems (GitHub via gh CLI, Atlassian via Rovo MCP and REST, Datadog), reusing the hardened shared runtime, adapters, and test suites under retrieval naming.
- Added `book/` — a seven-chapter verified tool book researched from primary sources with per-chapter adversarial fact-checking: `github-rate-limits.md`, `gh-cli-retrieval.md`, `atlassian-rovo-mcp.md`, `atlassian-rest-retrieval.md`, `datadog-retrieval.md`, `adaptive-scheduling.md`, `mcp-client-mechanics.md`, plus `book/index.md`.
- Added `workflow-and-gate-sequence.md` describing the 23-gate catalog adapted to the retrieval domain.
- Added `reference-snapshots.md` recording the vendored Python implementation sequence (byte-identical to the ADK harness snapshot).
- Ported and domain-adapted `operator-quick-reference.md`, `project-local-installation.md`, `repository-wide-agent-rules.md`, and `meta-operator-design.md` from the LangGraph sibling: retrieval command names, the `file:../../adk-harness/meta-harness` development dependency, retrieval data-authority and evidence-layer policy replacing the LangGraph state/persistence policy.
- Added `index.md` navigation for the bundle.
