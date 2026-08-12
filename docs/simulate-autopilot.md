---
type: report
title: "Autopilot Simulation Report"
description: "Adversarial tabletop verification of the Retrieval harness autopilot mode across OpenCode, Pi, the shared runtime, exact rendered prompts, operator branches, repairs, and remaining limitations."
timestamp: "2026-08-12T11:44:32-04:00"
---

# Autopilot Simulation Report

## Verdict

**Autopilot will work on both installed host adapters after the repairs recorded here.** The pre-repair implementation had two blocking authority gaps: Pi left an unaudited shell and mutation path available to the visible operator, and OpenCode could apply an operator question or shell decision before its ledger entry was durable. Both are closed. Six adversarial tracers and role-players found 18 distinct gaps (2 blocking, 10 degrading, 6 minor); all 18 were repaired and covered where the invariant is deterministic. The realistic first run should advance autonomously until a doctrine-defined critical blocker, but its semantic decisions still depend on the configured operator and gate models.

This was a **TABLETOP**. It invoked the local runtime and the real installed adapter registrations to render bytes and schemas, but launched no host/model session, made no paid request, contacted no GitHub, Atlassian, or Datadog endpoint, and operated no generated Retrieval agent.

## Method and installed contracts

The simulation used six read-only subagent passes: shared runtime/ledger/review binding; OpenCode adapter and installed plugin contract; Pi adapter and installed extension contract; doctrine/documentation wiring; end-to-end lifecycle role-play; and an independent prompt/host-wiring trace. Each tracer was instructed to assume the mode was broken, cite actual symbols, and compare adapter behavior with the installed APIs rather than an intended or paraphrased interface.

The inspected local contracts were:

| Component | Installed version | Contract inspected |
| --- | ---: | --- |
| `@opencode-ai/plugin` and `@opencode-ai/sdk` | 1.18.9 | Real plugin registration, Zod-derived JSON schemas, host question and permission payloads, tool execution context, and session APIs. |
| `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` | 0.80.6 | Real extension event registration, `before_agent_start`, `session_start`, `setActiveTools`, TypeBox/StringEnum schemas, session manager, request interception, and shutdown behavior. |
| `meta-harness` | 0.1.0 | Supervisor requests, approved facts, worker state, review binding, revocation, and transition lifecycle used by both supervised surfaces. |

The baseline, before repairs, was green: `node --test test/*.test.mjs` (108), `npm test --prefix .opencode` (63), and `npm test --prefix .pi` (52), for 223 tests. That green baseline was useful evidence about existing behavior, not proof that the authority model was correct; the adversarial trace found real gaps outside those assertions.

## Exact rendered inputs

The reproducible renderer is `.simulate-retrieval-harness/render-autopilot-packet.mjs`. It temp-copies the real bundle, calls `runStartCommand` with `sessionMode: "auto"`, loads the actual OpenCode plugin, registers the actual Pi extension, runs Pi's installed `before_agent_start` and `session_start` hooks, and emits the exact D01 packet, doctrine, active-tool set, and registered schemas:

```sh
node .simulate-retrieval-harness/render-autopilot-packet.mjs \
  --output .simulate-retrieval-harness/autopilot-grounding-post-repair.json
```

The post-repair D01 system prompt is 14,919 bytes, SHA-256 `9a72a0128178b541e2cafcf214a30d05a63f1ef5281d6ee0c01f336c5c51fae7`. Its exact opening and splice boundary are:

```text
# Shared Retrieval engineering rules

Before doing gate work, read the target repository's root `AGENTS.md` and, when present, `docs/repository-wide-agent-rules.md`. Follow more specific repository instructions for every file you touch.
```

```text
---

# Active Retrieval gate contract

Own D01 repository intake. Confirm the target repository path and the initial retrieval request from the kickoff packet; ask one short question only when either is missing or unusable.
```

The exact D01 kickoff is 3,788 bytes. Its SHA-256 is output-specific because the renderer creates a fresh temporary target and run id; the recorded run produced `5d442a81dd4e306c7eba00008afff42a6e04f44dfc328f4332a447b2f6761c91`. It opens:

```text
# Active gate: D01 — Repository intake and inventory

Target agent repository: /Users/ankitsingh/Documents/enterprise-workflow-harness/.simulate-retrieval-harness/auto-target-8DN13b
Initial idea: Build an enterprise retrieval agent that answers release-audit questions by planning a pipeline over GitHub (gh CLI), Jira and Confluence (Rovo MCP), and Datadog, retrieving in parallel near each provider's rate-limit budget with slow-start recovery, healing its retrieval scripts within bounded attempts, and cleaning every payload to minimal provenance-carrying records before inference.
Attempt: 1
```

and ends:

```text
Do not edit run control state, runtime or host adapters, the catalog, or the vendored reference. Keep the handoff short. The supervising autopilot operator reviews this result and advances the run.
```

OpenCode's `.opencode/agents/retrieval-autopilot.md` symlink resolved to the canonical `retrieval_agent_harness_phase_based/agents/retrieval-autopilot-operator.md`. The canonical file hash was `2cecea31740c6e265f29272db290bca42b61f3d12f070d6e51dc0206ed9d3f4a`; its frontmatter-stripped body hash was `5ec0f0c4e4092c4b0c68525ef410a6ad7d40bb9594dd172818d2ea92f19ed501`. OpenCode read that body exactly. Pi used the same body after the parser's documented `.trim()` and installed it after this real system prefix:

```text
SIMULATED PI BASE SYSTEM PROMPT

# Retrieval autopilot operator doctrine
```

The resulting Pi system prompt was 12,046 bytes, SHA-256 `22691016d8ea862614e5ba7bada0d427ca3e7c3e4c1cd5984d3fc0d4d5f36b13`. The effective prompt contains the corrected `23-gate sequence` wording and no `eighteen gates` wording. Pi's real active-tool call contained only:

```text
read, grep, find, ls, retrieval_auto_run, retrieval_auto_gate, retrieval_auto_transition
```

Both hosts registered the same three tool ids. The real schema action enums were:

| Tool | OpenCode actions | Pi actions |
| --- | --- | --- |
| `retrieval_auto_run` | `status`, `start`, `resume`, `recover` | same |
| `retrieval_auto_gate` | `wait`, `read`, `send`, `question_reply`, `question_reject`, `permission_reply`, `abort`, `release` | same, plus the legacy `permission_reject`; auto denial through `permission_reply {approve:false}` remains canonical |
| `retrieval_auto_transition` | `prepare`, `commit` | same |

## Harness walkthrough

| Step | Actual implementation |
| ---: | --- |
| 1 | The selected auto surface validates the named operator and configured model, resolves the exact repository root, and calls `runStartCommand(..., sessionMode: "auto")` (`.opencode/retrieval-operator-tools.ts:runAction`; `.pi/extensions/retrieval-meta-operator.ts:runAction`). |
| 2 | `plugin-runtime.mjs:launchPacket` renders the shared rules, gate prompt, allowed paths, result path, and auto-specific handoff; `recordLaunch` binds the callback's session mode to the commanding surface. |
| 3 | A fresh background worker is recorded in isolated `.retrieval-auto/` supervisor state. Gate sessions receive no manual, meta, or auto operator tools. |
| 4 | `retrieval_auto_gate wait/read` exposes the worker state, declared result fields, paginated transcript, pending question, or exact permission payload. OpenCode includes the full host permission object and resolved working directory; Pi includes the exact command and resolved `cwd`. |
| 5 | Question replies and shell approvals/denials are validated against the still-pending host request, ledgered, then delivered. Delivery failure leaves the audit decision visible and the request pending rather than applying invisible authority. |
| 6 | On an idle worker with a ready result, `release` validates and retires it. `prepare` builds the full review binding over runtime state, worker identity, result, artifacts, evidence, digests, decision, and next route. |
| 7 | `commit` recomputes that binding under the transition lease. Before state mutation it appends `gate_decision_intent`; after the atomic runtime commit it appends `gate_decision`. A changed byte, stale attempt, wrong mode, non-terminal worker, or model mismatch fails closed. |
| 8 | A next gate launches only when the catalog route is active and the forty-launch ceiling permits it. The final approval completes; block parks the run; a third revise for one gate returns `escalation_required/revise_cap`. |
| 9 | Human-directed resume accepts a non-empty relayed reason, records it, and relaunches. Crash recovery adopts only the exact recorded auto-owned attempt/session and preserves uncertain-delivery handling. |

## Anticipated operator run

Every output below is **ANTICIPATED**, derived from the installed schemas and implementation branches; it is not a transcript of a paid host/model run.

| # | Actor and action | Anticipated output and state |
| ---: | --- | --- |
| 1 | Human states the target and release-audit request once; operator restates both and calls `retrieval_auto_run start`. | `outcome: "started"`; D01 attempt 1 becomes active, auto-owned, and launch count is 1. |
| 2 | Operator calls `retrieval_auto_gate wait`. | Worker progress or an adopted correlated request is returned; no transition state changes. |
| 3 | D01 becomes idle with a ready result; operator reads from the transcript beginning, paginates if necessary, and reads every declared artifact/evidence file. | Review includes recommendation, summary, artifacts, evidence, uncertainties, blockers, transcript offsets, total count, and explicit truncation metadata. |
| 4 | Operator asks for the cheapest missing discriminating check with `send`, re-reads its raw output, then calls `release`. | Advisory message is relayed; the verified worker becomes terminal and remains bound to the recorded session. |
| 5 | Operator calls `prepare` with `approve`, then verifies the displayed digests and route. | `outcome: "prepared"`; no run decision is committed. |
| 6 | Operator calls `commit` with the doctrine's eight-part rationale. | `gate_decision_intent`, atomic state transition, and `gate_decision` are anticipated; D02 launches and `last_decision.decided_by_mode` is `auto`. |
| 7 | A worker asks a routine factual question. | The operator answers from approved context with cited fact ids; `question_answered` is durable before delivery. A scope-changing question is rejected or escalated instead. |
| 8 | A worker requests `python -m pytest` in the repository. | Operator inspects exact bytes, resolved working directory, and effects; `shell_approval {approved:true,payload_sha256,...}` precedes one-time host approval. |
| 9 | A worker requests a command that prints credentials or exfiltrates data. | Operator denies with a safe alternative; the denial is durable before host rejection and is relayed to the worker. Credential exposure itself becomes a critical escalation. |
| 10 | B27 evidence is insufficient; operator commits `revise`. | BR launches through the catalog's bounded-repair route. |
| 11 | BR is approved, then B25 and B26 re-run, returning to B27 attempt 2. | Each decision follows prepare/recompute/intent/commit/decision; attempts and launch count increase deterministically. |
| 12 | B27 attempt 2 still has a targeted defect; operator revises again. | BR attempt 2, B25, B26, then B27 attempt 3 are anticipated. |
| 13 | B27 attempt 3 would be revised a third time. | `outcome: "escalation_required", kind: "revise_cap"`; no decision or next launch is committed. |
| 14 | Operator attempts another prepare/commit without resolution. | The cap remains binding; autonomous progress stops and the operator reports the concrete blocker to the human. |
| 15 | Human supplies a direction in conversation; operator calls `resume` with that reason when the run is blocked. | `run_resumed` is ledgered and the allowed active route launches. The tool verifies a non-empty reason; conversational authorship is doctrine-bound, not mechanically authenticated. |
| 16 | The parent crashes mid-gate and restarts. | `status` exposes the interrupted/pending state; `recover` adopts or relaunches only the exact auto-owned attempt according to delivery state, never a different session or attempt. |

The final happy-path result is anticipated `status: "complete"` after the catalog-selected implementation path and validation route. Cost and elapsed time cannot be estimated honestly from this tabletop: both are dominated by configured provider/model pricing, gate work, repairs, and repository size, and no usage data was fabricated.

## Gaps and repairs

### Blocking

| Gap | Problem and evidence | Repair |
| --- | --- | --- |
| B1 | Pi injected only a doctrine snippet while leaving the visible operator's ordinary `bash`, `edit`, and `write` tools active. A model could bypass every shell ledger and modify work products directly (`.pi/extensions/retrieval-autopilot.ts`). | The full canonical doctrine is injected through the installed `before_agent_start` system-prompt hook, and `session_start` calls `setActiveTools` with only four read-only tools plus the three audited auto tools. Tests assert both the prompt and exact active list. |
| B2 | OpenCode applied question and permission replies to the host before appending the authority event, so an append failure could produce an effective but unaudited decision (`.opencode/retrieval-operator-tools.ts:gateAction`). | Every auto question/shell decision now revalidates the complete pending payload, appends the ledger event, then calls the host API and resolves the supervisor request. Tests inject ledger failure and prove the host effect does not occur. |

### Degrading

| Gap | Problem and evidence | Repair |
| --- | --- | --- |
| D1 | Pi put the multi-paragraph doctrine in `promptSnippet`, an installed field whose whitespace is normalized, so prompt fidelity was accidental (`.pi/extensions/retrieval-autopilot.ts`). | `promptSnippet` is now one line; the canonical Markdown body is loaded as a system section through `before_agent_start`. |
| D2 | Pi enforced the forty-launch ceiling on every commit, including `block` and final approval, creating an in-mode dead end (`.pi/extensions/retrieval-meta-operator.ts:transitionAction`). | The cap now applies only when `parsed.next.status === "active"` and a next gate would launch. Block and completion remain reachable at the ceiling; a regression test covers this route. |
| D3 | OpenCode could lazy-load and initialize the supervisor runtime before rejecting the wrong calling agent (`.opencode/retrieval-autopilot-tools.ts`). | A synchronous `assertAutopilotCaller` now runs before `runtimeFor()` in all three execute functions. |
| D4 | The graceful OpenCode loader treated nested missing dependencies as if the optional top-level `meta-harness` package itself were absent (`.opencode/retrieval-autopilot-loader.ts:isMissingGenericPackage`). | The tolerated regex now matches only the exact generic-package specifier/path; nested module failures remain fatal and are tested. |
| D5 | OpenCode auto kickoff facts claimed `retrieval_meta_run(start) human-confirmed intake`, a false tool and authorship provenance (`.opencode/retrieval-operator-tools.ts:seedApprovedContext`). | Each surface now owns an explicit intake provenance; auto records `retrieval_auto_run(start) autopilot intake`. |
| D6 | OpenCode's pending shell view told the auto operator to obtain a human exact-byte approval block, contradicting unattended operation (`.opencode/retrieval-operator-tools.ts:pendingRequestView`). | The auto view now supplies payload digest and operator-specific inspect/decide instructions; the human block remains byte-identical on meta only. |
| D7 | A caller could omit `sessionMode` and decide a meta/auto-owned attempt through a mode-less runtime call (`plugin-runtime.mjs:assertAttemptMode`). | Mode-less calls are accepted only for legacy manual attempts; a supervised attempt requires the commanding surface to identify the exact matching mode. |
| D8 | A shell relay exposed command bytes but not an explicit resolved working directory, leaving a load-bearing effect boundary implicit (both host adapters). | Pi includes `cwd`; OpenCode's canonical payload includes `resolved_working_directory` alongside the full permission object. Meta's existing canonical bytes remain unchanged. |
| D9 | Pi's pre-decision review omitted declared result fields, while both transcript views could silently show only a tail (`.pi/extensions/retrieval-meta-operator.ts:#reviewStatus`; `.opencode/retrieval-operator-tools.ts:gateAction`). | Pi returns recommendation, summary, artifacts, evidence, uncertainties, and blockers. Both hosts expose bounded pagination with explicit offset/total/truncation metadata and a beginning-first option. |
| D10 | A crash after runtime commit but before `gate_decision` append could leave a committed transition with no prior ledger evidence (`afterDecision` paths in both hosts). | Both hosts append `gate_decision_intent` through `afterReviewSnapshot`, after final byte binding but before state mutation. `gate_decision` remains the post-commit outcome record. |

### Minor

| Gap | Problem and evidence | Repair |
| --- | --- | --- |
| M1 | A custom prototype or enumerable `toJSON` could make the ledger's apparent input differ from serialized event/timestamp bytes (`autopilot-ledger.mjs`). | Entries must be plain objects without callable `toJSON`; the parsed serialized event and timestamp are revalidated, and the persisted object is returned. |
| M2 | The shared review binder trusted the caller to supply a terminal supervisor worker (`meta-review-binding.mjs:assertWorkerBinding`). | Binding now explicitly permits only `finished`, `aborted`, or `interrupted` worker states. |
| M3 | Automatic oversized-request rejections and Pi shutdown aborts changed worker state without an autopilot ledger event. | Both hosts ledger oversized denials; successful Pi shutdown revocation ledgers `worker_aborted` before aborting the supervisor record. |
| M4 | The doctrine said “eighteen gates” while the single catalog contains 23. | Canonical doctrine now says “the 23-gate sequence”; the post-repair rendered Pi system proves the stale phrase is absent. |
| M5 | The shared gate handoff always told “the human” to run a manual command, even in an auto-launched packet. | The shared rule now hands off neutrally to the reviewing operator through the owning surface; `launchPacket` still supplies the exact surface-specific final sentence. |
| M6 | Durable docs understated the sibling dependency, tool restriction, authority modes, resume enforcement class, decision intent, and report/index/log state. | `README.md`, `autopilot-design.md`, `project-local-installation.md`, `operator-quick-reference.md`, this report, `docs/index.md`, and `docs/log.md` now describe the observed contracts. |

## Prior-round finding triage

The supplied prior-round JSONL was treated as leads, not authority. Its confirmed gaps — Pi tool exposure, wrong auto provenance and permission guidance, launch-cap scope, oversized/shutdown ledger omissions, incomplete Pi review, transcript visibility, stale gate count, shared handoff, and docs drift — were reproduced against current symbols and repaired. Earlier launch-mode mismatch and “ledger return differs from persisted bytes” findings were already fixed in the starting tree and retained by regression tests. The earlier missing OpenCode `question_reject` affordance was also already fixed.

One prior claim was deliberately rejected: that shell command bytes must be copied into `decisions.jsonl`. The durable design and implemented event contract bind the complete ephemeral payload with SHA-256 while keeping command/credential material out of the ledger; the older scratch specification's prose conflicted with its own event shape and the repository's secret-safety rules. Audit review receives exact bytes before deciding, and the ledger records their digest plus rationale.

## Verification and limitations

The repaired slices passed targeted runs before the final matrix: root/shared 67/67, OpenCode 64/64, and Pi 55/55. The exact final three-suite matrix passed 232/232 tests, including both adapter typechecks:

- `node --test test/*.test.mjs` — **113/113 passed**
- `npm test --prefix .opencode` — **64/64 passed**
- `npm test --prefix .pi` — **55/55 passed**

The following are deliberate, documented limits rather than unresolved simulation findings:

- No real OpenCode or Pi model session was launched, so provider latency, model judgment, context-window behavior, token cost, and narration quality are unproven.
- No live provider/backend call or generated-agent operation was made. Credentials, host authentication, ignored model-role configuration, and the sibling `adk-harness/meta-harness` checkout remain setup prerequisites.
- The ledger and host effect cannot be one distributed transaction. Authority is durable before question/shell delivery; a delivery failure can therefore leave a decision entry that must be retried against the still-pending request. Gate transitions have a pre-commit intent and authoritative runtime state, but a crash may leave an orphan intent or omit the post-commit outcome line.
- Transcript pages are bounded; long message text is explicitly marked truncated and load-bearing evidence must be read from durable result/artifact files. This prevents silent context loss but does not make an arbitrarily large transcript fit one model turn.
- The forty-launch and two-revise bounds are deterministic controls, not semantic readiness scores. Autopilot may correctly escalate before completion when evidence, credentials, file authority, or a forbidden effect genuinely requires the human.
