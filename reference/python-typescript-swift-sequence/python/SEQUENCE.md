# Python Agent Sequence — the driver

A fixed, ordered sequence of **27 specialist stages**, then a re-validating **repair loop**
(≤ 2 rounds). Build a Python project by executing every stage below, in order, yourself.

This is a *tooling-free* sequence: there is no harness, no Node, no `AGENT_COMMAND`, no provider
process. **You are the runner.** See the universal execution contract in
[`../README.md`](../README.md); the binding parts are restated here so this file stands alone.

---

## Execution contract (read before stage 1)

1. **You personally perform every stage**, in the listed order, as a distinct step. The absence of
   a provider/harness is by design — it is never a reason to skip, merge, reorder, or improvise.
2. **Strict order, no skips.** A stage starts only when every upstream artifact it reads exists and
   satisfies its contract. The 27 planning/intake/writing stages are **sequential** — do not
   parallelize them.
3. **Frozen contracts.** Each planner artifact, once written, is an immutable input downstream. A
   later stage may *request a repair* of an upstream plan but must never silently reinterpret or
   widen it.
4. **Writers stay in lane.** Stages 14–24 may create/edit only the `allowed_files` the router
   (stage 13) assigned them, and may import only their approved imports.
5. **Rules are non-negotiable.** Enforce [`HARD-RULES.md`](./HARD-RULES.md) and every rule in each
   agent file. Never soften a rule. If a rule and the prompt truly conflict, stop and report.
6. **Honest gate.** Stage 27 may report `passed` only when stage 26's checks and the planned tests
   *actually ran and passed*. Unrun checks are `not_run` + repair tasks, never silent passes.

## Run dossier

Create `./.sequence/` at the root of the project you are building (git-ignore it). Each
planning/intake stage writes `./.sequence/<NN>-<agent>.json`; writers write real source files and
append to `./.sequence/INTEGRATION.md`; the gate stages write `static-analysis.json` and
`validation.json`. Every stage may read any earlier artifact by name; the **Reads** column lists the
key inputs each stage must consult.

For each stage: **open `agents/<file>`, read its inputs, perform the role exactly, write its
artifact, then proceed.** Reading the agent file for the current stage is mandatory, not optional.

---

## Phase 1 — Intake & source grounding (read-only)

| # | Stage | Agent file | Reads (key inputs) | Writes |
| ---: | --- | --- | --- | --- |
| 1 | RECEIVE_PROMPT | [`agents/01-prompt-intent-agent.md`](./agents/01-prompt-intent-agent.md) | raw user prompt | `01-prompt-intent.json` |
| 2 | GROUND_SOURCE_TEXT | [`agents/02-source-text-grounding-agent.md`](./agents/02-source-text-grounding-agent.md) | prompt + any provided source text; `01` | `02-source-text-grounding.json` |

## Phase 2 — Requirements (read-only)

| # | Stage | Agent file | Reads (key inputs) | Writes |
| ---: | --- | --- | --- | --- |
| 3 | NORMALIZE_REQUIREMENTS | [`agents/03-requirement-normalizer-agent.md`](./agents/03-requirement-normalizer-agent.md) | `01`, `02` | `03-requirement-normalizer.json` |
| 4 | WRITE_ACCEPTANCE_CRITERIA | [`agents/04-acceptance-criteria-agent.md`](./agents/04-acceptance-criteria-agent.md) | `03` (+`01`,`02`) | `04-acceptance-criteria.json` |

## Phase 3 — Planning (read-only; no code is written yet)

| # | Stage | Agent file | Reads (key inputs) | Writes |
| ---: | --- | --- | --- | --- |
| 5 | PLAN_PY_RUNTIME | [`agents/05-python-runtime-agent.md`](./agents/05-python-runtime-agent.md) | `01`, `03` | `05-python-runtime.json` |
| 6 | PLAN_ARCHITECTURE | [`agents/06-architecture-planner-agent.md`](./agents/06-architecture-planner-agent.md) | `03`, `04`, `05` | `06-architecture-planner.json` |
| 7 | SELECT_RULES | [`agents/07-python-rule-compliance-agent.md`](./agents/07-python-rule-compliance-agent.md) | `01` (forbidden), `02` (source rules), `06` | `07-python-rule-compliance.json` |
| 8 | PLAN_PACKAGES | [`agents/08-package-planner-agent.md`](./agents/08-package-planner-agent.md) | `05`, `06` | `08-package-planner.json` |
| 9 | PLAN_MODULES | [`agents/09-module-planner-agent.md`](./agents/09-module-planner-agent.md) | `06`, `08` | `09-module-planner.json` |
| 10 | PLAN_SYMBOLS | [`agents/10-symbol-planner-agent.md`](./agents/10-symbol-planner-agent.md) | `06`, `09` | `10-symbol-planner.json` |
| 11 | PLAN_IMPORTS | [`agents/11-import-planner-agent.md`](./agents/11-import-planner-agent.md) | `06`, `09`, `10` | `11-import-planner.json` |
| 12 | PLAN_TESTS | [`agents/12-test-planner-agent.md`](./agents/12-test-planner-agent.md) | `04`, `06`, `10` | `12-test-planner.json` |

## Phase 4 — Routing (read-only)

| # | Stage | Agent file | Reads (key inputs) | Writes |
| ---: | --- | --- | --- | --- |
| 13 | ROUTE_TASKS | [`agents/13-router-agent.md`](./agents/13-router-agent.md) | `07`,`08`,`09`,`10`,`11`,`12` | `13-router.json` |

> The router emits one scoped task per artifact. Each writer below receives **only** its
> `allowed_files`, approved imports, required rules, forbidden patterns, and the upstream artifacts
> it needs. Honor those scopes exactly.

## Phase 5 — Writing (write / edit; stay in your lane)

| # | Stage | Agent file | Reads (key inputs) | Writes |
| ---: | --- | --- | --- | --- |
| 14 | WRITE_PYPROJECT | [`agents/14-pyproject-writer-agent.md`](./agents/14-pyproject-writer-agent.md) | `05`, `08`, `13` | `pyproject.toml`, `.python-version`, `.gitignore`, package skeleton |
| 15 | WRITE_DATA_MODELS | [`agents/15-data-model-writer-agent.md`](./agents/15-data-model-writer-agent.md) | `10`, `13` | data-model modules (dataclass/Enum/TypedDict/NamedTuple) |
| 16 | WRITE_PROTOCOLS | [`agents/16-protocol-writer-agent.md`](./agents/16-protocol-writer-agent.md) | `10`, `11`, `13` | `typing.Protocol`/ABC port modules |
| 17 | WRITE_CLASSES | [`agents/17-class-writer-agent.md`](./agents/17-class-writer-agent.md) | `10`, `11`, `13` | class shells with explicit `__init__` deps |
| 18 | WRITE_SIGNATURES | [`agents/18-function-signature-agent.md`](./agents/18-function-signature-agent.md) | `10`, `11`, `13` | typed signatures (no mutable defaults) |
| 19 | WRITE_BODIES | [`agents/19-function-body-agent.md`](./agents/19-function-body-agent.md) | `18`, `06`, `07` | function bodies (signatures & imports unchanged) |
| 20 | WRITE_RESOURCE_LIFECYCLE | [`agents/20-resource-lifecycle-agent.md`](./agents/20-resource-lifecycle-agent.md) | `19`, `07` | `with`/`contextlib`/`try-finally` cleanup |
| 21 | WRITE_DEPENDENCY_PROVIDERS | [`agents/21-dependency-provider-writer-agent.md`](./agents/21-dependency-provider-writer-agent.md) | `10`, `13` | `build_*`/`main` wiring (runtime only) |
| 22 | WRITE_INTERFACE_ADAPTERS | [`agents/22-interface-adapter-writer-agent.md`](./agents/22-interface-adapter-writer-agent.md) | `05`, `13`, `21` | CLI / FastAPI / Flask / worker adapter |
| 23 | WRITE_UNIT_TESTS | [`agents/23-unit-test-writer-agent.md`](./agents/23-unit-test-writer-agent.md) | `12`, `10`, `13` | unit tests (fakes through seams) |
| 24 | WRITE_INTEGRATION_TESTS | [`agents/24-integration-test-writer-agent.md`](./agents/24-integration-test-writer-agent.md) | `12`, `22`, `13` | CLI / API / package-boundary tests |

## Phase 6 — Assembly & gate

| # | Stage | Agent file | Reads (key inputs) | Writes |
| ---: | --- | --- | --- | --- |
| 25 | INTEGRATE | [`agents/25-integration-agent.md`](./agents/25-integration-agent.md) | all writer outputs | `INTEGRATION.md` (merged manifest + conflicts) |
| 26 | RUN_STATIC_ANALYSIS | [`agents/26-static-analysis-agent.md`](./agents/26-static-analysis-agent.md) | integrated files, `05` (commands), `07` | `static-analysis.json` (exact commands + real output) |
| 27 | VALIDATE | [`agents/27-validator-agent.md`](./agents/27-validator-agent.md) | `04`, `07`, `12`, `26` | `validation.json` (passed/failed + `repair_tasks`) |

---

## The gate (stage 27)

The validator is the **gatekeeper**. It does not author or fix code. It reports `passed: true`
**only** when:

- `python -m py_compile` succeeded for every generated module, and
- the AST mutable-default scan, AST import-time-construction scan, and layer-import scan found no
  violations, and
- the planned tests (stage 12) actually ran and passed, and
- the selected `PY-*` rules (stage 7) and acceptance criteria (stage 4) are satisfied.

Any check that did not run is recorded `not_run` with a repair task. `passed` is never granted on
"the code looks correct."

## Repair loop (only when stage 27 fails; ≤ 2 rounds)

```text
validator-agent (fail)
   → repair-agent              # patch ONLY the validator-reported files; preserve frozen contracts
   → integration-agent         # re-merge
   → static-analysis-agent     # re-run the real checks
   → validator-agent           # re-gate
   (repeat while failing and rounds < 2)
```

- The repair agent ([`agents/repair-agent.md`](./agents/repair-agent.md)) reads `validation.json`,
  patches **only** the files named in `repair_tasks`, and preserves every approved contract and all
  passing behavior. It writes `repair-<round>.json`.
- After 2 rounds, if still failing, finish with status `needs_review` and the outstanding
  `repair_tasks` — do **not** declare success.

## Not part of the sequence

`baseline-agent` (single-shot whole-prompt generation) was a benchmark-only comparison condition
and is intentionally excluded. Every agent still enforces the shared
[`HARD-RULES.md`](./HARD-RULES.md) block locally.

See [`PIPELINE.md`](./PIPELINE.md) for the diagram.
