---
type: Guide
title: Retrieval Harness Project-Local Installation
description: Explains how to place, configure, load, and deterministically verify the Retrieval OpenCode and Pi adapters and their optional meta-operator.
timestamp: 2026-08-12T08:40:00-04:00
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

Pi's `.pi/settings.json` force-excludes `extensions/retrieval-meta-operator.ts` from normal discovery. This keeps the optional `meta-harness` dependency out of ordinary manual startups while auto-loading `.pi/extensions/retrieval-phase.ts`.

## Deterministic setup

The manual adapter needs only the project-local bundle. The optional meta-operator additionally needs the generic `meta-harness` package, resolved in this development layout via `file:../../adk-harness/meta-harness`, with installed package dependencies:

```sh
cd ../adk-harness/meta-harness && npm install && npm test
cd ../../enterprise-workflow-harness/.opencode && npm install && npm test
cd ../.pi && npm install && npm test
```

The relative commands assume the shell begins in `enterprise-workflow-harness`. Each host package runs a deterministic `check:dist` before typechecking, so a missing, stale, incomplete, or altered `meta-harness` build fails closed. When `meta-harness` is absent entirely, the OpenCode loader exposes no meta tools and manual mode keeps working without any npm install.

Use a supported Node line; the deterministic verification for this bundle completed under Node v23.11.0 (`engines` requires >= 22.6). Review any npm advisories against the locked tree and host threat model instead of applying an unreviewed automatic major-version fix.

Create real, ignored model configuration files from the examples:

- `.opencode/retrieval-operator-models.example.json` to `.opencode/retrieval-operator-models.json`
- `.pi/retrieval-operator-models.example.json` to `.pi/retrieval-operator-models.json`

The background `gate` model is required and explicit. `operator: null` means the visible session model remains the operator; setting an operator entry pins and verifies it. OpenCode may pin a variant, while Pi may pin an effective thinking level.

Select the `retrieval-operator` agent in OpenCode for meta mode. In Pi, opt in explicitly:

```sh
pi -e .pi/extensions/retrieval-meta-operator.ts
```

Do not remove Pi's normal-discovery exclusion to enable this mode. A successful local install proves package and adapter compatibility, not live backend credentials (gh auth, Atlassian MCP consent, Datadog keys), provider behavior, generated-system correctness, or deployment.

## Interactive smoke conditions

Run one non-production interactive smoke in each host after configuring real ignored model files and authenticating the selected models. For OpenCode, use an initialized, non-global Git project and start the session from the exact Git root that is also the harness target and session directory. The host request must carry `path=""`, allowing the adapter to resolve and verify that exact root; a global project identity or a nested working directory is intentionally rejected. Exercise start, one worker exchange, human review, transition, clean retirement, and restart recovery without pointing the smoke at production data or effects.

For Pi, load either normal manual mode or the explicit meta extension, not both ownership modes for one run. Exercise the same lifecycle and verify clean shutdown. Treat the forced status-1 process exit on any cleanup failure that prevents a safe shutdown outcome as the expected fail-closed result and validate dead-owner recovery in a disposable session.

## Portability boundary

Development uses `file:` dependencies across the three co-located directories. Moving only this harness is unsupported. A distributable package must replace those paths with immutable versions, include verified build artifacts, and test the exact packed installation.
