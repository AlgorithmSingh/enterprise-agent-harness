---
type: Policy
title: Repository-Wide Retrieval Agent Rules
description: Defines the engineering, file-authority, evidence, safety, and documentation policy shared by every Retrieval harness gate.
timestamp: 2026-08-12T08:40:00-04:00
---

# Repository-Wide Retrieval Agent Rules

These rules explain the project policy referenced by `AGENTS.md`. They guide semantic work, but they do not replace the runtime's catalog, protected run state, or exact file-authority checks.

## Use current retrieval contracts

- Pin one coherent Python and package baseline via uv (isolated environment, `uv.lock`, `.python-version`), with every backend-facing dependency choice cited to current official documentation and recorded with its access date.
- `docs/book/` is the binding authority for every external contract: GitHub REST/GraphQL/search limits, gh CLI behavior, the Atlassian Rovo MCP server, Jira/Confluence REST, Datadog, deterministic MCP client mechanics, and adaptive scheduling. When live behavior contradicts a chapter, record the discrepancy and correct the chapter in the same change.
- Every external read flows through a versioned retrieval script from the script registry with typed parameters and a declared budget class; nothing composes ad-hoc backend calls at inference time, and retrieval scripts perform no external writes.
- Model budget buckets exactly as the book defines them, one limiter per bucket, and enforce the utilization ceiling as a per-window dispatch allowance against each bucket's limit, derived from observed headers or client-side counters. Treat `Retry-After` as a strict minimum; recover concurrency by slow start toward the cut level; never busy-retry a limited backend.
- Keep identity, credentials, clocks, transports, and randomness in injected application-owned context so every timing behavior is testable with fakes; credential values never appear in artifacts, fixtures, logs, or evidence.

## Separate data authorities

- The retrieval cache holds revalidation state and bounded response copies; the dossier holds one pipeline run's cleaned records and plan; the provenance ledger records source, query, retrieval time, and budget spent; the healing ledger records script repairs with failure classification and diffs. None of these substitutes for another.
- Raw backend payloads never reach the inference step. Every retrieval stage pairs with a deterministic cleaning step producing minimal schema-validated records, pure and unit-testable against recorded fixtures.
- Classify failures before repair: deterministic script defects are fixed at the producer and recorded in the healing ledger; transient external failures get bounded backoff-retry without script edits; upstream API drift heals the script and the book chapter together. Healing is bounded per script per run and never weakens a validator or budget guard.
- Persist cursors within their documented lifetimes and treat cursor chains as sequential state; parallelism comes only from disjoint shards.

## Preserve human and file authority

- One focused gate works at a time and recommends rather than decides. Only the human selects a catalog-allowed transition.
- The accepted run-scoped Phase 2 manifest controls exact implementation paths. A working-tree proposal never widens the current attempt's authority.
- Do not write through symlinks, hard links, non-canonical paths, case-folded aliases, or glob-like spellings. Do not edit `.git`, the harness runtime, host adapters, vendored references, or run records from a generated-project gate.
- File-tool guards do not turn an arbitrary shell into a filesystem sandbox. A human may approve a shell command only after inspecting its complete recorded bytes, resolved working directory, target paths, and effects; an approval must not be treated as permission to bypass the gate's declared authority.
- The gate result's changed-file list and the runtime's working-tree checks are declarative accounting, not an operating-system write barrier. Reviewers must reconcile the declared list with the actual diff before accepting a result.
- B17 through B20 may transform the same explicitly planned file in order. Other writer overlap requires an explicit design reason and protected manifest authority.
- B25 integrates without repairing, B26 records literal validation evidence, B27 validates independently, and BR repairs only the reported findings within the bounded manifest union.

## Make evidence honest

Keep these claims separate: static/configuration evidence (E0), deterministic unit contracts with fake clocks and transports (E1), recorded-fixture pipeline replay (E2), opt-in live smoke bounded to a small budget slice (E3), and live operations (E4+), which remain downstream. A higher layer never replaces a lower deterministic contract, and `simulated`, `not_run`, `unavailable`, and `not_applicable` must not become "passed". Never promote one layer into another by wording alone.

Tests should enforce stable correctness, safety, integrity, compatibility, or regression invariants. Do not use line counts, keyword counts, file counts, arbitrary readiness scores, or formatting trivia as proxies for semantic quality.

## Maintain durable documentation

Durable Markdown belongs under `docs/`, follows the local OKF frontmatter and index rules, and is recorded in `docs/log.md`. External source snapshots remain read-only under `reference/`; disposable research or simulation work remains in dot-prefixed scratch directories.
