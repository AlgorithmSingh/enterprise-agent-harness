---
type: Architecture
title: Autopilot Mode Design
description: Defines the third operating mode in which one visible operator agent takes every routine gate decision under a binding judgment doctrine, with an auditable decision ledger and critical-blocker-only escalation to the human.
timestamp: 2026-08-12T11:44:32-04:00
---

# Autopilot Mode Design

Autopilot is the third operating mode beside manual and meta. The human states a request once to a single visible operator agent — the `retrieval-autopilot` agent in OpenCode, or a Pi session with the opt-in autopilot extension loaded — and that agent drives the entire gate sequence itself: it launches each gate in a fresh background worker session on the configured gate model, reviews the declared result and evidence, decides approve, revise, or block, answers worker questions, approves or denies shell requests after inspecting the exact command bytes, and continues until the run completes or a critical blocker requires the human. The manual and meta modes remain fully supported and unchanged.

## What moved, and what deliberately did not

The only authority that moves is the human's routine review authority, which transfers to the autopilot operator agent. Everything else keeps its owner. The shared runtime still owns the generic invariants — gate identity, the seven-field envelope, byte digests, path confinement, catalog routing, bounded repair, atomic single-commit transitions — and carries a third `auto` session-mode value plus a durable `decided_by_mode` field on `last_decision`. Gate workers still own the domain work, still cannot approve themselves, and still cannot call any operator tool. Mode ownership is immutable per attempt: an auto-owned attempt refuses manual, meta, and mode-less callers, and an attempt owned by a human surface refuses the autopilot.

Architecturally the autopilot is an authority variant of the existing meta-operator integration, not a parallel engine. Each host's meta core has a construction-time surface selector whose default preserves meta behavior. The auto surface replaces human-authorization checkpoints with agent-supplied decisions plus mandatory ledger writes, while worker lifecycle, model-role verification, request correlation, transition leases, quiesce-then-retire ordering, launch recovery, and fail-closed shutdown stay on the shared code paths.

## The judgment doctrine

The autopilot operator's decision quality is carried by one canonical prompt: [`retrieval_agent_harness_phase_based/agents/retrieval-autopilot-operator.md`](../retrieval_agent_harness_phase_based/agents/retrieval-autopilot-operator.md). OpenCode loads it as the `retrieval-autopilot` agent definition. Pi installs the same frontmatter-stripped body as a dedicated system-prompt section through `before_agent_start`; its `retrieval_auto_run` prompt snippet stays a short one-line description because the installed Pi contract normalizes snippets. Pi also restricts the visible operator to read-only inspection plus the three auto tools, mechanically matching the no-shell/no-edit doctrine that OpenCode enforces through frontmatter.

The doctrine supplies the eight-part decision loop, evidence and revise discipline, artifact and completion boundaries, the worker-shell trust boundary, and critical-blocker escalation calibration. It requires the operator to inspect actual result, artifact, evidence, transcript, command, and working-directory data rather than accepting a worker's references as proof.

## The decision ledger

Every ordinary authority action the autopilot takes is appended to `.retrieval-agent-runs/<run-id>/autopilot/decisions.jsonl` through the shared [`autopilot-ledger.mjs`](../retrieval_agent_harness_phase_based/autopilot-ledger.mjs). Question and shell decisions are ledgered before the host applies them. Gate transitions write `gate_decision_intent` after final byte review and before runtime state commit, then `gate_decision` after commit; a crash can leave an uncommitted intent or a committed state with only its intent, but not a committed operator decision with no prior audit record. The ledger is evidence, not authority — the runtime state file remains the only transition record — and credential values never appear in it.

## Bounds and escalation

Because the run is unattended, two deterministic caps are enforced by the auto surfaces on top of the catalog's own bounded repair: at most two revises for any gate and at most forty gate launches per run. The launch cap applies only to actions that actually launch another worker, so block and final completion remain reachable at the ceiling. Critical blockers include block decisions, exhausted bounds, fail-closed runtime refusals, credential exposure, and shell requests the doctrine forbids approving.

The doctrine permits a blocked run to resume only after the human's instruction in conversation. The tool requires and ledgers the non-empty relayed reason but cannot mechanically authenticate conversational authorship.

## Shell authority

Per the project owner's decision, the autopilot approves gate workers' shell requests itself. The worker is blocked inside the intercepted call while the operator inspects the exact command bytes and resolved repository working directory. The guards still confine file writes, but an approved command executes with the operator's authority, so the doctrine's deny list plus the per-approval payload hash are the control. Question and shell decisions are recorded before the host applies them. Manual and meta modes keep shell approval with the human.

## Configuration and coexistence

Autopilot reuses each host's `retrieval-operator-models.json` and keeps supervisor state in separate `.retrieval-auto/` directories. The `meta-harness` sibling/package is required by both supervised modes. Only one operator surface should be loaded per run; ownership conflicts fail closed. Enabling instructions live in the [installation guide](project-local-installation.md), day-to-day behavior in the [operator quick reference](operator-quick-reference.md), and the adversarial verification record in the [autopilot simulation report](simulate-autopilot.md).
