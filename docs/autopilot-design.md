---
type: Architecture
title: Autopilot Mode Design
description: Defines the third operating mode in which one visible operator agent takes every routine gate decision under a binding judgment doctrine, with an auditable decision ledger and critical-blocker-only escalation to the human.
timestamp: 2026-08-12T14:30:00-04:00
---

# Autopilot Mode Design

Autopilot is the third operating mode beside manual and meta. The human states a request once to a single visible operator agent — the `retrieval-autopilot` agent in OpenCode, or a Pi session with the opt-in autopilot extension loaded — and that agent drives the entire gate sequence itself: it launches each gate in a fresh background worker session on the configured gate model, reviews the declared result and evidence, decides approve, revise, or block, answers worker questions, approves or denies shell requests after inspecting the exact command bytes, and continues until the run completes or a critical blocker requires the human. The manual and meta modes remain fully supported and unchanged.

## What moved, and what deliberately did not

The only authority that moves is the human's routine review authority, which transfers to the autopilot operator agent. Everything else keeps its owner. The shared runtime still owns the generic invariants — gate identity, the seven-field envelope, byte digests, path confinement, catalog routing, bounded repair, atomic single-commit transitions — and gained only a third `auto` session-mode value plus a durable `decided_by_mode` field on `last_decision`, so the run state itself records that a decision was agent-taken. Gate workers still own the domain work, still cannot approve themselves, and still cannot call any operator tool. Mode ownership is immutable per attempt: an auto-owned attempt refuses manual and meta surfaces, and an attempt owned by a human surface refuses the autopilot, in both directions and under the same fail-closed checks as before.

Architecturally the autopilot is an authority variant of the existing meta-operator integration, not a parallel engine: each host's meta core gained a construction-time surface selector whose default preserves meta behavior exactly, and the auto surface replaces the human-authorization checkpoints (exact-byte confirmation blocks in OpenCode, TUI confirmation dialogs in Pi) with agent-supplied decisions plus mandatory ledger writes. Worker lifecycle, model-role verification, request correlation, transition leases, quiesce-then-retire ordering, launch recovery, and the fail-closed shutdown boundary are the same code paths in both surfaces.

## The judgment doctrine

The autopilot operator's decision quality is carried by one canonical prompt: [`retrieval_agent_harness_phase_based/agents/retrieval-autopilot-operator.md`](../retrieval_agent_harness_phase_based/agents/retrieval-autopilot-operator.md). OpenCode loads it as the `retrieval-autopilot` agent definition (a symlink, like the gate prompts); Pi injects its frontmatter-stripped body as the prompt snippet of `retrieval_auto_run`. It is a distillation of the project owner's engineering-judgment corpus into binding review doctrine: the eight-line decision loop run before every commit; evidence discipline (results are drafts of claims; reproduce and stress-test load-bearing claims; verify falsifiable specifics before they raise severity and demote when they fail; never credit a "missing/fabricated" verdict without checking the dispatched context was complete; name the proxy in every success claim; within-run certainty is narrower than pipeline-level certainty; never grade a worker only by artifacts it can edit); revise discipline (smallest reversible step; diagnose before deleting or rebuilding; strip speculative machinery; the architecture-substitution alarm; the precedence clause that correctness, security, privacy, data integrity, and explicit requirements are never simplified away); scope boundaries (judge against the declared artifact bar, the pull-request-ready completion boundary, and the test-while-designing hand-off bar — "tests will be added later" never satisfies approval); the shell-approval trust boundary; and the escalation calibration that reserves interruptions for genuinely critical blockers.

## The decision ledger

Every authority action the autopilot takes is appended to `.retrieval-agent-runs/<run-id>/autopilot/decisions.jsonl` through the shared [`autopilot-ledger.mjs`](../retrieval_agent_harness_phase_based/autopilot-ledger.mjs): run start and resume, each gate decision with the operator's recorded rationale and the review-manifest digest, each worker question answered, each shell approval or denial with the payload hash, each escalation, and worker aborts and releases. The ledger is evidence, not authority — the runtime state file remains the only transition record — but a ledger write failure fails the action that required it, so nothing is decided unrecorded. Credential values never appear in the ledger.

## Bounds and escalation

Because the run is unattended, two deterministic caps are enforced by the auto surfaces on top of the catalog's own bounded repair: at most two revises for any gate (a third is refused as an escalation) and at most forty gate launches per run. The blockers that stop autonomous progress and reach the human are: a block decision, cap exhaustion, fail-closed runtime refusals (changed catalog, changed reviewed file, stale attempt, ownership conflict, model mismatch, failed revocation), credential exposure, and shell requests the doctrine forbids approving. A blocked run resumes only after the human's instruction in conversation, relayed as the resume reason and ledgered.

## Shell authority

Per the project owner's decision, the autopilot approves gate workers' shell requests itself. The worker is blocked inside the intercepted call while the operator inspects the exact command bytes; the guards still confine file writes, but an approved command executes with the operator's authority, so the doctrine's deny list (credential values, writes outside the repository and run directory, history rewrites, publishing, exfiltration, unneeded network access) plus the per-approval ledger hash are the control. This is a trust boundary the human accepts when opting into autopilot mode; the manual and meta modes keep shell approval with the human.

## Configuration and coexistence

Autopilot reuses each host's existing `retrieval-operator-models.json` (required background `gate` role; optional visible `operator` pin, verified when present) and keeps its supervisor state in separate `.retrieval-auto/` directories, so meta and auto never share or corrupt each other's state. Only one operator surface should be loaded per run; ownership conflicts fail closed regardless. Enabling instructions live in the [installation guide](project-local-installation.md); day-to-day behavior in the [operator quick reference](operator-quick-reference.md).
