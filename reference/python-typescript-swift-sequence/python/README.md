# Python Agent Sequence

A strict, ordered **sequence of specialist agents** for building a production-quality Python
project. It decomposes "write the software" into many narrow, contract-driven stages — intent →
source grounding → requirements → planning → routing → writing → assembly → a real verification
gate → a bounded repair loop — so explicit dependency-inversion seams, type safety, resource
safety, and repairability survive instead of being lost to one-shot generation.

**The runner is the coding agent itself.** There is no tooling to invoke — no harness, no Node, no
provider process, nothing to "shell out" to. Running this sequence means *you personally perform
every stage, in order, as a distinct step.* That is the intended and only execution model, never a
fallback; the absence of a provider is never a reason to skip, merge, reorder, or improvise.

## The shape

**27 ordered stages**, then a re-validating **repair loop**: when stage 27 (the gate) fails,
`repair → integrate → static-analysis → validate`, up to **2 rounds**; if it still fails, finish as
`needs_review` — never a declared success.

## What's here

- **[`SEQUENCE.md`](./SEQUENCE.md)** — the driver. The execution contract, the 27 ordered stages
  with their inputs/outputs, the gate, and the repair loop. Execute it stage by stage.
- **[`HARD-RULES.md`](./HARD-RULES.md)** — the shared hard-rules block every agent enforces (single
  source of truth): no mutable defaults, no import-time side effects, explicit dependency injection,
  `with`/`contextlib`/`try-finally` cleanup, no bare `except`, layered imports, `uv`-managed
  environment, clean working tree, Python only.
- **[`PIPELINE.md`](./PIPELINE.md)** — the stage-order diagram.
- **[`agents/`](./agents/)** — one file per stage (`NN-<agent>.md`): mission, boundaries, inputs,
  output contract, and rules. For each stage in `SEQUENCE.md`, open the matching agent file, read
  its inputs from the run dossier, perform the role exactly, and write its artifact.

## The rules are deliberate

Every rule in `HARD-RULES.md` and in each agent file is **binding and book-derived** — not a style
suggestion. **Do not make this sequence more lenient.** Never relax, drop, or "simplify away" a rule
for expedience. If a rule and the user's prompt genuinely conflict, **stop and report it** rather
than silently choosing leniency. The gate is honest: the validator may report `passed` only when the
required static checks and tests *actually ran and passed*; anything that did not run is recorded
`not_run` with repair tasks.

## Intentionally excluded

The `baseline-agent` (single-shot whole-prompt generation), the orchestration harness, and the
scoring machinery are **not** part of this sequence and were left out on purpose. They were
measurement-and-comparison scaffolding around the sequence, not part of building the software. Their
removal changes nothing about the stage order, the per-stage contracts, the hard rules, or the
repair behavior — all of which are preserved exactly.
