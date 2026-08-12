---
type: Architecture
title: Retrieval Harness Meta-Operator Design
description: Defines the optional visible operator, cheaper background gate worker, generic supervisor reuse, exact human authorization, and host-specific integration boundary.
timestamp: 2026-08-12T14:30:00-04:00
---

# Retrieval Harness Meta-Operator Design

The optional meta-operator keeps the human in one visible operator session while a separately configured background model runs each focused gate. The same integration also carries the [autopilot mode](autopilot-design.md), an authority variant in which the operator agent takes the decisions this document assigns to the human. It has three layers:

```text
OpenCode or Pi adapter
  -> meta-harness integration profile
    -> reusable meta-harness supervisor
      -> project-local Retrieval workflow runtime
```

The generic `meta-harness` remains the sole owner of one-worker lifecycle, durable supervisor state, exclusive ownership, serialization, correlated requests, approved facts, model-role verification, prepared proposals, transcript authorization, usage accounting, and interrupted recovery. The retrieval namespace, paths, command names, and operator identity live in the project-local host adapters, which also translate native sessions, messages, tools, model identities, and usage.

## Role boundary

The visible `operator` may monitor, relay a worker question, challenge incomplete evidence, prepare a transition proposal, and commit only an exact human-authored confirmation. The background `gate` worker owns the focused gate task. The operator cannot answer a material worker question from itself, approve a gate, select a catalog route, reuse another run's facts, or release a worker before verified terminal state.

The roles are independently configured and verified even when a user intentionally assigns the same provider/model. OpenCode checks provider, model, and configured variant. Pi checks provider, model, and effective thinking level after host clamping.

## Authorization binding

Start, resume, gate permission, worker-question answer, and gate transition each use a canonical human-authored block. A transition proposal binds the exact workflow catalog, run/gate/attempt/launch, host and session, operator identity, verified worker identity/model, reviewed result, declared artifact/evidence bytes, decision/reason, and computed route. The adapter rebuilds that binding at commit time and requires byte-for-byte equality.

Oversized authorization-bearing payloads are rejected rather than truncated. A host request must resolve to the exact pending request, and every state-changing callback rechecks the active worker identity and task scope. Host revocation or interruption happens before terminal release; uncertainty remains visible and recoverable rather than being rewritten as success.

## Installed Pi shutdown boundary

Core shutdown retains the exact child handle, loaded supervisor, project context, non-terminal worker record, and exclusive ownership when child revocation fails. It reports `revocation_failed` without disposing anything, so direct callers and deterministic tests can retry against the same child handle. It terminalizes the worker and releases ownership only after revocation succeeds.

The installed Pi lifecycle needs a stricter boundary. Pi awaits `session_shutdown`, then invalidates and disposes the extension runtime, and handler errors are not a reliable way to keep that runtime available. Consequently, the actual registered handler calls the exported non-returning terminator (`process.exit(1)`) after a retained revocation failure or any thrown cleanup error. A returning injected test terminator causes an explicit error rather than permitting continuation. This covers failure before revocation, during revocation, and after revocation but before terminal metadata or ownership release. Nonzero process death stops a possibly live in-process child and makes any retained live-owner record recoverable as a dead-owner interruption by a successor.

## Operational scope

One host process owns one run at a time. The project-local owner record prevents two live local supervisors from adopting the same state and permits an exact dead-owner recovery, but it is not a distributed lease. Concurrent ownership across machines, network filesystems with weak locking semantics, and active-active operation require an external coordination design and are outside this harness.

The nonzero Pi exit after an unrevocable child is intentional fail-closed behavior, not a graceful-shutdown guarantee. Operators should run the interactive smoke in a disposable, non-production session and confirm that the next process reports and recovers the interruption honestly.

## Evidence boundary

Deterministic package and adapter tests validate the supervisor integration, model-role separation, authorization, file authority, failure recovery, and workflow interaction. They do not call a model or prove live host authentication, provider billing/usage reporting, generated Retrieval behavior, or deployment. One non-production interactive smoke in each host remains the final environmental check.

Human-approved shell execution remains a host trust boundary: the adapter binds and displays exact command bytes, but tool-specific path guards are not an operating-system sandbox for arbitrary shell effects. Approval therefore requires inspection of the complete command, working directory, paths, and expected effects.
