# Enterprise Retrieval Agent Harness

A human-gated, phase-based agent harness that designs and implements **enterprise retrieval agent systems** in Python — systems that take a request, plan an explicit retrieval pipeline over **GitHub (gh CLI)**, **Atlassian Jira/Confluence (Rovo MCP server, with a REST fallback)**, and **Datadog (REST)**, execute it in parallel as close to each provider's rate limit as a utilization ceiling allows, back off and re-scale by slow start when limited, heal LLM-authored retrieval scripts in a bounded audited loop, clean every raw payload to a minimal schema-validated record, and only then run inference.

It is a domain sibling of the ADK and LangGraph agent harnesses: the same human-controlled gate mechanics (one ordered catalog, two slash commands, a seven-field result envelope, run-pinned file authority, bounded repair), with the retrieval domain carried entirely in the gate prompts, shared rules, and the verified tool book.

## Orientation

| Where | What |
| --- | --- |
| [`docs/index.md`](docs/index.md) | Documentation bundle navigation. |
| [`docs/workflow-and-gate-sequence.md`](docs/workflow-and-gate-sequence.md) | The 23-gate workflow: design (D01–D12), manifest-selected implementation (B14–B22), assurance (B24–B27), bounded repair (BR). |
| [`docs/book/index.md`](docs/book/index.md) | The verified tool book — binding external-contract authority for GitHub rate limits, gh CLI, Rovo MCP, Jira/Confluence REST, Datadog, deterministic MCP clients, and adaptive rate-limit scheduling. Every constant fact-checked against primary sources, then corrected further by prototype evidence. |
| [`docs/operator-quick-reference.md`](docs/operator-quick-reference.md) | Day-to-day operation: `/retrieval-phase` to start, `/retrieval-phase-next` to review and advance. |
| [`docs/project-local-installation.md`](docs/project-local-installation.md) | Installation and the optional meta-operator mode. |
| [`retrieval_agent_harness_phase_based/`](retrieval_agent_harness_phase_based/) | The gate catalog (`workflow.json`), canonical gate prompts, shared engineering rules, and the shared runtime. |
| [`.prototype/`](.prototype/README.md) | Design-spike evidence: the rate-limit scheduler contract proof and the MCP headless-client contract check, whose findings corrected the book before implementation. |
| [`reference/`](docs/reference-snapshots.md) | Read-only vendored Python implementation sequence (provenance in `docs/reference-snapshots.md`). |

## Quick start

Open OpenCode or Pi at this repository root (or a repository this bundle has been merged into) and run `/retrieval-phase`, then `/retrieval-phase-next` after each gate completes. Manual mode needs no npm install. Deterministic verification:

```sh
npm ci --prefix .opencode     # requires the meta-harness sibling checkout
npm ci --prefix .pi           # required by the root Pi contract tests
node --test test/*.test.mjs
npm test --prefix .opencode
npm test --prefix .pi
python3 -m unittest discover -s .prototype/001-rate-limit-scheduler/spike -v
```

**Sibling-checkout prerequisite (full verification and optional meta mode):** both adapter packages resolve the generic supervisor via `file:../../adk-harness/meta-harness`, so a fresh clone must sit beside an `adk-harness` checkout (`<parent>/adk-harness/meta-harness` next to `<parent>/<this-repo>`). Without it, `npm ci` under `.pi`/`.opencode` fails and the optional meta-operator is unavailable; manual mode remains usable, but the root suite's Pi contract files also require `.pi/node_modules`. Use Node `^22.22.2`, `^24.15.0`, or `>=26` for the locked tree. See [`docs/project-local-installation.md`](docs/project-local-installation.md).

The harness ends at production-intended, pull-request-ready generation and validation; operating a generated system against live tenants remains a downstream human decision.
