---
type: architecture
title: "Retrieval Agent Harness Workflow and Gate Sequence"
description: "The ordered human-controlled design, implementation, assurance, and bounded-repair workflow for producing a pull-request-ready enterprise retrieval agent system."
timestamp: "2026-08-12T08:32:00-04:00"
---

# Retrieval Agent Harness Workflow and Gate Sequence

[`workflow.json`](../retrieval_agent_harness_phase_based/workflow.json) is the single ordered gate catalog. Each gate has one focused responsibility, each launched agent recommends an outcome, and a human selects every transition from the choices allowed by that catalog entry.

The subject of a run is an enterprise retrieval agent system: a Python application that takes a request, plans an explicit retrieval pipeline over GitHub (gh CLI), Atlassian Jira/Confluence (Rovo MCP server with a REST fallback), and Datadog (REST), executes that plan in parallel as close to each provider's rate-limit budget as the utilization ceiling allows, backs off and re-scales by slow start when limited, heals LLM-authored retrieval scripts in a bounded audited loop, cleans every raw payload to a minimal schema-validated record, and only then runs inference. [`docs/book/`](book/index.md) is the verified external-contract authority the gates design against.

## Technical design

Nine design gates establish the implementation contract before production code is written.

| Gate | Focused responsibility | Canonical output |
| --- | --- | --- |
| D01 | Inventory the repository, instructions, backend tooling evidence (gh, MCP, Datadog credentials as facts), the tool book, reusable work, assumptions, and risks. | `.sequence/design/01-repository-intake.json` |
| D02 | Define outcomes, requirements, non-goals, compatibility, retrieval-specific acceptance criteria (cleaned-record contract, rate-limit compliance in fixture replay, bounded healing), the evaluation bar, and the pull-request-ready boundary. | `.sequence/design/02-outcome-acceptance.json` |
| D03 | Define the Python/uv runtime baseline and the smallest adequate application contract: request intake, pipeline planner, script registry, scheduler, cleaning step, and inference boundary with a no-provider fake mode. | `.sequence/design/03-runtime-application-contract.json` |
| D05 | Define the backend retrieval-script contracts, budget buckets, failure taxonomies, auth preconditions, trust boundaries, and the read-only effects boundary, per the tool book. | `.sequence/design/05-tools-trust-effects.json` |
| D06 | Define the script registry, retrieval cache, cursor persistence, cleaned-record schemas with provenance, dossier, healing ledger, budget telemetry, secrets hygiene, and explicit deferrals. | `.sequence/design/06-state-data-artifacts.json` |
| D07 | Define pipeline orchestration and the scheduler contract: per-bucket limiters, header-driven pacing, utilization ceiling, AIMD with slow-start recovery, per-backend backoff protocols, healing-loop placement, terminals, and lifecycle observability. | `.sequence/design/07-orchestration-lifecycle.json` |
| D09 | Project the approved design into a minimal Python architecture and plain-language engineering rules, with injected clock/randomness/transport for the scheduler. | `.sequence/design/09-python-architecture-rules.json` |
| D10 | Define the package, module, symbol, import, provider, and implementation routing blueprint, including proposed B14–B22 activation and exact paths. | `.sequence/design/10-code-blueprint.json` |
| D12 | Reconcile the current design into one readable technical design, assemble the behavioral oracle including the rate-limit scenario classes, and finalize the run-scoped implementation manifest. | `docs/retrieval-agent-technical-design.md` and `.sequence/phase-2-manifest.json` |

The retained gate IDs deliberately match the ADK and LangGraph sibling harnesses: D04, D08, and D11 remain retired, and the implementation gate numbering stays aligned with the vendored Python sequence stages recorded in [`reference-snapshots.md`](reference-snapshots.md).

The semantic workspace is living. Technical-design gates and active B14–B22 writers may improve relevant design artifacts, focused prompts, the shared prompt, and durable documentation — including correcting a tool-book chapter when observed behavior contradicts it — when that work is necessary for their focused responsibility. They must report every changed file, preserve approved behavior, and keep documentation navigation and [`log.md`](log.md) current.

## Manifest-selected implementation

D12 approval copies the validated Phase 2 manifest into protected run state. That run-scoped copy—not a later working-tree edit—selects optional B14–B22 gates and supplies each active implementation session's exact production and unit-test paths.

| Gate | Focused responsibility |
| --- | --- |
| B14 | Python project configuration and package skeleton via uv. |
| B15 | Data and cleaned-record models, pipeline plans, bucket state, ledger entries. |
| B16 | Protocols: backend clients, scheduler, cache, clock, script registry, cleaning, inference boundary. |
| B17 | Side-effect-free class shells and explicit constructor dependencies. |
| B18 | Final typed function and method signatures. |
| B19 | Function and method behavior, including the scheduler algorithms against injected clock and randomness. |
| B20 | Resource and cache lifecycle: deterministic release of subprocess handles, HTTP clients, MCP sessions, and cache files on success and error paths. |
| B21 | Dependency providers and proportional composition. |
| B22 | Approved backend adapters (gh subprocess, MCP client, Datadog, Atlassian REST) and entry interfaces. |

Inactive optional gates are skipped with their manifest reasons. B14–B17 retain concise stage records; B18–B22 write their routed implementation and test files directly and use only the generic gate result.

## Mandatory behavioral and assurance gates

| Gate | Focused responsibility |
| --- | --- |
| B24 | Implement the D12-approved behavioral and rate-limit Given/When/Then scenarios — Retry-After minimum-delay compliance, sleep-to-reset, backoff with slow-start re-scaling, per-window allowance ceilings, bucket isolation, healing classification, cleaning minimality — in exact manifest-authorized test and fixture files with fake clocks and transports. |
| B25 | Reinspect and reconcile the complete integrated tree, writing only `.sequence/INTEGRATION.md`. |
| B26 | Execute the complete applicable approved static and test commands and record literal commands, environment, exit status, relevant failures, and honest unexecuted reasons. |
| B27 | Independently judge acceptance, rule, behavioral, isolation, and B26 evidence — including conformance to the budget law, backoff protocols, healing bounds, and cleaning minimality — classifying findings as repairable or blocking. |

B25–B27 are report-only or read-only apart from their own required evidence files. They do not change production code to manufacture a passing result.

## Bounded repair

A human Revise decision at B27 routes to BR. BR receives the deduplicated union of files authorized for active B14–B22 and mandatory B24, makes only validator-directed repairs, and writes `.sequence/repair-<attempt>.json`. An approved repair returns through the complete B25, B26, and B27 sequence. BR is limited to two attempts; an exhausted, non-repairable, or unauthorized problem blocks instead of being treated as success.

## Control and judgment boundaries

| Owner | Enforced responsibility |
| --- | --- |
| Shared runtime | Serialized first-run creation; sessions and v2 run state; immutable launch identity; per-attempt catalog byte binding; the seven-field result envelope; safe path and file authority; run-scoped manifest selection; catalog routing; bounded repair; recovery; and direct human-selected state transitions. |
| Pi and OpenCode adapters | Thin host session launch, catalog-derived decision UI, equivalent tool/file permission enforcement, safe host retirement or revocation, and host-specific stale-session checks. |
| Focused agents and prompts | Retrieval-domain interpretation, upstream discovery, design completeness, code and test quality, diagnostics, and honest evidence. |
| Human | Every semantic approval and every workflow transition. |

The harness ends with production-intended, pull-request-ready generation and validation. Live pipeline operation against real GitHub, Atlassian, or Datadog tenants — including any billed or budget-consuming smoke beyond the approved E3 slice — remains an explicit downstream human responsibility.

## Reference provenance

The snapshot under [`reference/python-typescript-swift-sequence/`](reference-snapshots.md) remains read-only provenance. Active gate prompts are self-contained adaptations of the retained engineering responsibilities; the runtime does not inject raw vendored prompts.
