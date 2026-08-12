# Repository organization

## Required policy read

- Before beginning repository work, read `docs/repository-wide-agent-rules.md` when it is present. Root `AGENTS.md` remains the active instruction authority; the policy document explains the approved repository-wide rules without becoming a second machine registry.
- Treat semantic design documents as living collaborative work. A focused agent may revise relevant earlier or future semantic artifacts and canonical gate prompts when needed for its current responsibility, provided it preserves approved behavior, reports every change, leaves a Git-visible diff for canonical prompts and durable documentation (run-scoped `.sequence/` artifacts are reviewed through the gate result's declared files), and maintains applicable `docs/index.md` files and `docs/log.md`.
- A prompt edit affects only newly launched sessions. A future artifact remains draft material until its own final human gate decision.
- The protected run-scoped Phase 2 manifest, not a working-tree proposal, controls exact implementation authority for the current session. Agents never select workflow transitions for the human.

## Durable documentation

- `docs/` is an Open Knowledge Format (OKF) v0.1 knowledge bundle. Keep durable project-authored documentation there, except coding-agent instruction files such as this one.
- Every non-reserved Markdown file under `docs/` must start with YAML frontmatter containing non-empty `type`, `title`, `description`, and `timestamp` fields.
- Every directory under `docs/` must contain an `index.md`. Keep each index limited to immediate child documents and directories, with a one-sentence description for each entry. Index files have no frontmatter.
- `docs/log.md` is the canonical reserved documentation changelog and has no frontmatter. Update it when durable documentation is added, moved, removed, renamed, or materially revised.
- Use structured Markdown and valid relative links.

## Scope and simplicity

- This repository provides focused agent prompts and thin project-local OpenCode and Pi adapters. Do not add a CLI, daemon, service, controller package, DSL, or a second gate registry.
- `retrieval_agent_harness_phase_based/workflow.json` is the single ordered gate catalog.
- The shared runtime owns only sessions, state, generic result validation, file authority, routing, recovery, and human-selected transitions. Retrieval design and implementation meaning belongs in the gate prompts and human review.
- Keep one focused responsibility per gate. Do not add dynamic child gates or infer gates from names.
- Prefer a small, demonstrated change over speculative abstractions. Investigate existing behavior before rebuilding it.

## Rules and evidence

- State requirements, design obligations, checks, evidence, and repair findings in plain engineering language. Do not replace their meaning with opaque coded aliases.
- Add deterministic tests or enforcement only for a documented stable invariant and a concrete correctness, safety, integrity, compatibility, or regression risk. Leave semantic quality to agent and human review when it cannot be checked mechanically.
- Do not use line counts, keyword inventories, file counts, formatting rules, readiness scores, or arbitrary thresholds as proxies for prompt, design, code, or artifact quality.
- Inspect the consolidated open decisions in the current TDD when they are materially relevant. Mention an unresolved item only when it affects the user's current request; do not recite unrelated cautions.
- The harness ends at production-intended, pull-request-ready generation and validation. Do not deploy or operate generated Retrieval agents or claim unexecuted deployment, migration, canary, rollback, uptime, incident, or production-load evidence.

## Reference snapshots

- Treat `reference/` as read-only source material, not active repositories.
- Do not add nested `.git` metadata.
- Record snapshot provenance in `docs/reference-snapshots.md` and snapshot changes in `docs/log.md`.
