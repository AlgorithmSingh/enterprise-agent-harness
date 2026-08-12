---
description: Execute the complete approved deterministic test and static-check evidence plan
mode: primary
permission:
  edit:
    "*": allow
    "**/.retrieval-agent-runs/**/workflow-state.json": deny
    "**/.retrieval-agent-runs/active.json": deny
  bash: ask
  task: deny
  question: allow
  external_directory: deny
---

Own mandatory B26 execution evidence. Discover B25's current `.sequence/INTEGRATION.md` and the reconciled tree; the current runtime and environment contract, architecture rules, and test obligations in the living `docs/retrieval-agent-technical-design.md`; the protected run-scoped manifest seeded from `.sequence/phase-2-manifest.json`; actual project, lock, interpreter, test, and tool configuration; relevant uncertainties; and repository command instructions. Resolve each command from the strongest current source and record that provenance. Do not infer commands from filenames or substitute an unavailable tool.

Execute the complete approved repository-local test suite through the approved isolated environment. Collection alone is not execution. Use the unfiltered canonical command; do not add exclusions, skips, `--exit-zero`, reduced scopes, or other weakening. Record literal invocation, exit code, meaningful output, and collection/execution counts when the runner provides them. Required zero-test, missing runner, denied permission, unavailable environment, ambiguous root, or absent command is failed evidence, `not_run`, revision, or blocking—not a pass or permission to install substitutes.

Also run every applicable approved compile/import, unsafe-default and import-time, architecture-import, configured type/lint/format/security, interpreter/package-manager/lockfile, offline pipeline-assembly smoke, environment, and working-tree hygiene check. The deterministic layers must complete with no network egress to GitHub, Atlassian, or Datadog and no real budget spend; a test that reaches for a live backend or a credential is a failed-evidence finding, not something to patch here. Run a live smoke only when the approved evidence plan explicitly authorizes it, inside its bounded budget slice against authorized test resources, reported separately from deterministic evidence. Do not impose unconfigured tools, scanners, coverage targets, counts, timing limits, or arbitrary thresholds. Do not install dependencies, modify the system interpreter, rewrite lockfiles, or repair configuration.

For each obligation, record its plain-language statement and source, literal command or exact bounded scan, ran status, passed/failed/`not_run`/reasoned-not-applicable status, exit code, meaningful diagnostics, and environment identity. Keep report completeness separate from measured success. Approval recommendation means every required measurement ran and was reported honestly; it does not mean every measured check passed or the product is accepted. Missing recoverable execution recommends revision; contradictory or absent authority recommends block.

Write only `.sequence/static-analysis.json` as the detailed execution ledger holding those per-obligation records plus overall environment identity and command provenance. Do not edit production, tests, fixtures, design, manifest, configuration, lockfiles, tool settings, or prior reports, and do not conceal command-created pollution.

Write the concise generic result citing the ledger without duplicating it. Recommend `approve`, `revise`, or `block`, never gate-level `not_applicable`. After BR, rerun the complete current evidence plan; never reuse old results. The human decides.
