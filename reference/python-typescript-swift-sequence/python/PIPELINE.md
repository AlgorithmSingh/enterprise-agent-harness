# Pipeline — stage execution order

The Python sequence is a fixed, ordered, **linear** pipeline that you — the runner — execute
yourself, stage by stage: **27 sequential stages**, then a re-validating **repair loop** (≤ 2
rounds). Stage numbers, names, and order below match [`SEQUENCE.md`](./SEQUENCE.md) exactly.

```text
================================================================================
  PYTHON AGENT SEQUENCE                       27 stages  +  repair loop (<=2x)
  you are the runner — perform each stage in order, as a distinct step
================================================================================

                               [ user prompt ]
                                      |
                                      v
  +--------------------------------------------------------------------------+
  | PHASE 1 - INTAKE & SOURCE GROUNDING                          read-only    |
  +--------------------------------------------------------------------------+
    1. RECEIVE_PROMPT ............ prompt-intent-agent
                                   goal, project kind, forbidden patterns
    2. GROUND_SOURCE_TEXT ........ source-text-grounding-agent
                                   rules grounded in the provided source text
                                      |
                                      v
  +--------------------------------------------------------------------------+
  | PHASE 2 - REQUIREMENTS                                       read-only    |
  +--------------------------------------------------------------------------+
    3. NORMALIZE_REQUIREMENTS .... requirement-normalizer-agent
                                   observable, testable requirements
    4. WRITE_ACCEPTANCE_CRITERIA . acceptance-criteria-agent
                                   binary AC-PY-* pass/fail criteria
                                      |
                                      v
  +--------------------------------------------------------------------------+
  | PHASE 3 - PLANNING  (no code is written yet)                 read-only    |
  +--------------------------------------------------------------------------+
    5. PLAN_PY_RUNTIME ........... python-runtime-agent
                                   version, packaging, runner, py -m commands
    6. PLAN_ARCHITECTURE ......... architecture-planner-agent
                                   layers, dep direction, composition root
    7. SELECT_RULES .............. python-rule-compliance-agent
                                   PY-* rule ids + rationale
    8. PLAN_PACKAGES ............. package-planner-agent
                                   src/<pkg>/ + tests/ + pyproject layout
    9. PLAN_MODULES .............. module-planner-agent
                                   per-module responsibility & import policy
   10. PLAN_SYMBOLS .............. symbol-planner-agent
                                   functions, dataclasses, protocols, errors
   11. PLAN_IMPORTS ............. import-planner-agent
                                   locked import edges + forbidden edges
   12. PLAN_TESTS ............... test-planner-agent
                                   success / failure / seam / import-safety
                                      |
                                      v
  +--------------------------------------------------------------------------+
  | PHASE 4 - ROUTING                                            read-only    |
  +--------------------------------------------------------------------------+
   13. ROUTE_TASKS .............. router-agent
                                   one scoped task -> one specialist writer
                                      |
              +-----------------------+-----------------------+
              |  each writer receives ONLY its allowed_files, |
              |  approved imports, required rules, forbidden  |
              |  patterns, and the upstream artifacts it reads|
              +-----------------------+-----------------------+
                                      v
  +--------------------------------------------------------------------------+
  | PHASE 5 - WRITING  (sequential; stay in your lane)        write / edit   |
  +--------------------------------------------------------------------------+
   14. WRITE_PYPROJECT .......... pyproject-writer-agent
                                   pyproject.toml + .python-version + skeleton
   15. WRITE_DATA_MODELS ........ data-model-writer-agent
                                   dataclass / Enum / TypedDict / NamedTuple
   16. WRITE_PROTOCOLS .......... protocol-writer-agent
                                   typing.Protocol / ABC ports
   17. WRITE_CLASSES ............ class-writer-agent
                                   class shells w/ explicit __init__ deps
   18. WRITE_SIGNATURES ......... function-signature-agent
                                   typed signatures, no mutable defaults
   19. WRITE_BODIES ............. function-body-agent
                                   bodies (signatures & imports unchanged)
   20. WRITE_RESOURCE_LIFECYCLE . resource-lifecycle-agent
                                   with / contextlib / try-finally cleanup
   21. WRITE_DEPENDENCY_PROVIDERS dependency-provider-writer-agent
                                   build_* / main wiring (runtime only)
   22. WRITE_INTERFACE_ADAPTERS . interface-adapter-writer-agent
                                   CLI / FastAPI / Flask / worker adapter
   23. WRITE_UNIT_TESTS ......... unit-test-writer-agent
                                   fakes through seams
   24. WRITE_INTEGRATION_TESTS .. integration-test-writer-agent
                                   CLI / API / package-boundary tests
                                      |
                                      v
  +--------------------------------------------------------------------------+
  | PHASE 6 - ASSEMBLY & GATE                                                 |
  +--------------------------------------------------------------------------+
   25. INTEGRATE ............... integration-agent
                                 merge files, detect conflicts (no authoring)
   26. RUN_STATIC_ANALYSIS ..... static-analysis-agent
                                 py_compile, AST scans, layer scan, test run
   27. VALIDATE ............... validator-agent
                                 GATEKEEPER: pass/fail + targeted repair_tasks
                                      |
                              +-------+-------+
                         pass |               | fail
                              v               v
                    [ DONE: passed ]   +-------------------------------+
                                       | REPAIR LOOP  (up to 2 rounds) |
                                       |                               |
                                       |   repair-agent                |
                                       |     -> integration-agent      |
                                       |     -> static-analysis-agent  |
                                       |     -> validator-agent        |
                                       |          |                    |
                                       |   still failing & rounds<2 ?  |
                                       |     yes --> loop   no --> out  |
                                       +-------------------------------+
                                                   |
                                                   v
                                       [ passed  |  needs_review ]

--------------------------------------------------------------------------------
  OFF-SEQUENCE
    * repair-agent ... runs only when stage 27 fails (loop above); patches ONLY
                       the validator-reported files; preserves frozen contracts.
    * baseline-agent . single-shot whole-prompt generation; intentionally
                       excluded — it is not part of this sequence.

  EVERY stage also enforces the shared hard rules (see HARD-RULES.md):
    no mutable defaults | no import-time side effects | explicit DI |
    with/contextlib/try-finally cleanup | no bare except | layered imports |
    uv-managed env | clean working tree | Python only
--------------------------------------------------------------------------------
```

Notes that the diagram cannot show:

- **Read-only vs. writing.** Stages 1–13 read and plan only; they write contract artifacts to the
  run dossier, never source. Stages 14–24 create/edit real source files, each strictly inside the
  `allowed_files` the router (stage 13) assigned it.
- **Strictly sequential.** All 27 stages run one after another. Nothing here is parallelized; a
  stage starts only when every upstream artifact it reads exists and satisfies its contract.
- **Frozen contracts.** Each planner artifact, once written, is an immutable input downstream. A
  later stage may *request a repair* of an upstream plan, but never silently reinterprets or widens
  it.
- **Honest gate.** Stage 27 reports `passed` only when stage 26's checks and the planned tests
  *actually ran and passed*. Unrun checks are recorded `not_run` with repair tasks, never silent
  passes.

Source of truth: SEQUENCE.md (which you, the runner, execute stage by stage).
