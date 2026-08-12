---
type: Guide
title: Retrieval Harness Project-Local Installation
description: Explains how to place, configure, load, and deterministically verify the Retrieval OpenCode and Pi adapters and their optional meta-operator and autopilot modes.
timestamp: 2026-08-12T14:30:00-04:00
---

# Retrieval Harness Project-Local Installation

The supported installation boundary is the target repository itself. Opening OpenCode or Pi from that root discovers the manual adapter and makes `/retrieval-phase` and `/retrieval-phase-next` available. The command rejects a different target path deliberately.

Keep these paths together when merging the bundle into an existing repository:

```text
AGENTS.md
CLAUDE.md
.opencode/
.pi/
retrieval_agent_harness_phase_based/
docs/
reference/python-typescript-swift-sequence/
```

Pi's `.pi/settings.json` force-excludes `extensions/retrieval-meta-operator.ts` and `extensions/retrieval-autopilot.ts` from normal discovery. This keeps the optional `meta-harness` dependency out of ordinary manual startups while auto-loading `.pi/extensions/retrieval-phase.ts`.

## Deterministic setup

The root control-plane suite imports the Pi extension contract tests, so a full fresh-clone verification requires both adapter dependency trees even when day-to-day manual mode does not. The optional meta-operator additionally needs the generic `meta-harness` package, resolved in this development layout via `file:../../adk-harness/meta-harness`. From the repository root:

```sh
npm ci --prefix .opencode
npm ci --prefix .pi
node --test test/*.test.mjs
npm test --prefix .opencode
npm test --prefix .pi
python3 -m unittest discover -s .prototype/001-rate-limit-scheduler/spike -v
```

The `file:../../adk-harness/meta-harness` dependency means `npm ci` requires a sibling checkout at `<parent>/adk-harness/meta-harness`; each host package runs a deterministic `check:dist` before typechecking, so a missing, stale, incomplete, or altered build fails closed. When that sibling is absent, manual mode still loads without npm, but the full root and adapter verification suites are unavailable and must be reported as such rather than called self-contained.

Use Node `^22.22.2`, `^24.15.0`, or `>=26`; the locked OpenCode dependency tree contains `ini@7`, which declares Node 23 unsupported even though the local package's older broad engine declaration permits it. Node v23.11.0 passed the suites during repository creation but emitted an engine warning and is not a supported clean-install baseline. Review any npm advisories against the locked tree and host threat model instead of applying an unreviewed automatic major-version fix. The Pi packages are exact dev/test mirrors of the installed host API, so update them only with a matching Pi host upgrade and rerun both Pi suites.

Create real, ignored model configuration files from the examples:

- `.opencode/retrieval-operator-models.example.json` to `.opencode/retrieval-operator-models.json`
- `.pi/retrieval-operator-models.example.json` to `.pi/retrieval-operator-models.json`

The background `gate` model is required and explicit. `operator: null` means the visible session model remains the operator; setting an operator entry pins and verifies it. OpenCode may pin a variant, while Pi may pin an effective thinking level.

Select the `retrieval-operator` agent in OpenCode for meta mode. In Pi, opt in explicitly:

```sh
pi -e .pi/extensions/retrieval-meta-operator.ts
```

For the fully autonomous [autopilot mode](autopilot-design.md), select the `retrieval-autopilot` agent in OpenCode, or in Pi:

```sh
pi -e .pi/extensions/retrieval-autopilot.ts
```

Autopilot uses the same model-role files (the background `gate` role is required) and keeps its own supervisor state under `.opencode/.retrieval-auto/` and `.pi/.retrieval-auto/`. Load exactly one operator surface per run — manual, meta, or autopilot; mode ownership fails closed on crossover regardless. Opting into autopilot accepts its documented trust boundary: the operator agent takes gate decisions and approves worker shell commands itself, recording every authority action in the run's decision ledger.

Do not remove Pi's normal-discovery exclusions to enable these modes. A successful local install proves package and adapter compatibility, not live backend credentials (gh auth, Atlassian MCP consent, Datadog keys), provider behavior, generated-system correctness, or deployment.

## Interactive smoke conditions

Run one non-production interactive smoke in each host after configuring real ignored model files and authenticating the selected models. For OpenCode, use an initialized, non-global Git project and start the session from the exact Git root that is also the harness target and session directory. The host request must carry `path=""`, allowing the adapter to resolve and verify that exact root; a global project identity or a nested working directory is intentionally rejected. Exercise start, one worker exchange, human review, transition, clean retirement, and restart recovery without pointing the smoke at production data or effects.

For Pi, load either normal manual mode or the explicit meta extension, not both ownership modes for one run. Exercise the same lifecycle and verify clean shutdown. Treat the forced status-1 process exit on any cleanup failure that prevents a safe shutdown outcome as the expected fail-closed result and validate dead-owner recovery in a disposable session.

## Portability boundary

Development uses `file:` dependencies across the three co-located directories. Moving only this harness is unsupported. A distributable package must replace those paths with immutable versions, include verified build artifacts, and test the exact packed installation.
