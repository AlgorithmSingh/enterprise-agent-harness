---
type: report
title: "Simulation Report"
description: "Tabletop verification of the ported retrieval harness: deterministic control-plane evidence, rendered-prompt grounding, the adversarial trace and role-play findings, and the repairs applied."
timestamp: "2026-08-12T09:20:00-04:00"
---

# Simulation Report

## Verdict

**The harness will work in manual mode as shipped.** The control plane is deterministically verified (183/183 tests across three suites), the real rendered D01 packet is correct end-to-end, four adversarial tracers found no blocking defects and confirmed the port byte-equivalent to its hardened LangGraph sibling after rename normalization, and both role-plays traced the 18-launch happy path and the failure/repair/recovery branches to the code's actual behavior. Everything blocking or degrading that the simulation surfaced has been repaired in the working tree; the remainder is documented setup prerequisites. The realistic first-run outcome for a full gate run remains dependent on the quality of launched gate agents and human review — the harness's own mechanics are not the risk.

## What was simulated, and how it was grounded

- **Rendered, not paraphrased:** `node scripts/render-d01-packet.mjs` executes the real `runStartCommand` against a temp copy of the installation bundle and prints the exact launch packet — the spliced system prompt (shared engineering rules → `---` → `# Active Retrieval gate contract` → the D01 body with frontmatter stripped), the kickoff message with the literal seven-field envelope, the collaborative edit paths, and the exact result path under `.retrieval-agent-runs/<run-id>/gates/D01/attempt-1/`. Re-run the command to reproduce the bytes.
- **Deterministic suites:** `node --test test/*.test.mjs` (94), `npm test --prefix .opencode` (46, incl. typecheck), `npm test --prefix .pi` (43, incl. typecheck) — all passing at report time.
- **Adversarial tracers** (read-only, one slice each): shared runtime + catalog + review binding; the `.opencode` adapter chain including all 23 agent symlinks; the `.pi` adapter chain including the force-exclusion and guard constants; and the prompt ↔ catalog ↔ book ↔ docs wiring. Each was told to assume the port was broken and prove it, and to diff against the LangGraph sibling for lost wiring.
- **Role-plays:** the 18-launch route (D01…D12 → manifest-selected B19 → B24 → B25 → B26 → B27 → BR → B25 → B26 → B27 → complete) with per-gate anticipated behavior cross-checked against `nextOrderedGate`/`launchPacket`/`runNextCommand`; and the failure branches — manifest-widening refusal, the two-attempt BR bound, stale-lock crash recovery, uncertain kickoff delivery, and manual/meta ownership conflicts.

## Findings and repairs

15 gaps were found: 0 blocking, 4 degrading, 11 minor. All repairs below are applied and re-verified by the full test matrix.

| Severity | Finding | Disposition |
| --- | --- | --- |
| degrading | `scripts/render-d01-packet.mjs` copied only the catalog directory into its temp target, while the rendered packet obliges the agent to read the target's `AGENTS.md` and `docs/book/`. | **Repaired** — the script now copies `AGENTS.md`, `CLAUDE.md`, and `docs/` into the temp target. |
| degrading | `.sequence/` is gitignored while the shared rules demanded every collaborative edit "leave the change visible in Git" — a contradiction inherited from the sibling. | **Repaired** — Git-visibility is now scoped to canonical prompts and durable documentation; run-scoped `.sequence/` artifacts are reviewed through the gate result's declared files (shared rules and `AGENTS.md` amended). |
| degrading ×2 | Both adapter packages resolve `meta-harness` via `file:../../adk-harness/meta-harness`, outside the repository — a fresh standalone clone cannot `npm install` the adapters. | **Documented prerequisite** — this mirrors the reference architecture's deliberate portability boundary. The sibling-checkout layout is now stated as a hard prerequisite in `README.md` and `docs/project-local-installation.md`. Manual mode and the root suite need no install and are unaffected; the OpenCode loader degrades to manual-only when the package is absent. |
| minor | `docs/index.md` linked this report before it existed. | **Repaired** — this document. |
| minor | D01, D05, and D06 omitted `allowed_human_decisions`, offering a meaningless "Not Applicable" at three required design gates. | **Repaired** — restricted to approve/revise/block in the catalog and the catalog-contract test. |
| minor | Operator quick reference claimed BR "stops" after two attempts (no such run state) and omitted stale-lock recovery. | **Repaired** — reworded to the actual refusal behavior ("Targeted repair reached its 2-attempt repair limit", B27 left undecided) and the stale-lock bullet added. |
| minor | B25's prompt named all four writer stage records unconditionally, though skipped writers produce none. | **Repaired** — qualified to manifest-active writers, with the manifest reason as the expected evidence for skipped ones. |
| minor | LangGraph-era residue: the render script's and e2e test's sample intake ideas, and brand-style mid-sentence "Retrieval" capitalization in operator-facing strings. | **Repaired** — domain-accurate intake ideas; generic lowercase wording ("What should the enterprise retrieval agent being built do?"). |
| minor | `.web-docs/` (the book's fetched-source cache, ~7 MB of public documentation extracts) was flagged as committable scratch. | **Accepted deliberately** — the cache is retained in the repository so later healing and verification agents can re-ground book claims without re-fetching; it is excluded from OKF indexes per the scratchpad convention. |

## Documented limitations (setup, not bugs)

- Adapter test suites and the optional meta-operator require the `adk-harness` sibling checkout and `npm install`; manual mode does not.
- Nothing live was exercised: no real gate-agent sessions on a host model, no OpenCode/Pi interactive smoke, and no calls to GitHub, Atlassian, or Datadog. The book's live-endpoint claims (Rovo quotas, 429 behavior, OAuth flows) carry their own verification labels, and prototype `002` deliberately stopped at the offline boundary.
- The generated retrieval systems this harness produces are validated to the pull-request-ready boundary only; operating one against live tenants is a downstream human decision.

## Prototype evidence feeding this simulation

`.prototype/001-rate-limit-scheduler/` (22/22 deterministic tests; corrected the book's pacing formula to a per-window dispatch allowance and pinned the three-number slow-start contract) and `.prototype/002-mcp-headless-client/` (real stdio round trip against `mcp` 1.29.0; corrected the MCP error-channel model, the mcp-remote callback-port derivation, and the version pin). Their corrections are reflected in the book, the shared rules, and the D02/D03/D05/D07/D12/B24/B27 prompts, and `PLANS/PROTOTYPE-CHECKLIST.md` records both decisions.
