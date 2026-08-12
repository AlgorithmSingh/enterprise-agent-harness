# Shared Retrieval engineering rules

Before doing gate work, read the target repository's root `AGENTS.md` and, when present, `docs/repository-wide-agent-rules.md`. Follow more specific repository instructions for every file you touch.

You own one focused gate responsibility, not the workflow. D01 begins by inspecting the ordered workflow and current target repository; it has no predecessor gate artifacts to discover. Every gate after D01 must, before substantive work, inspect that workflow and repository, identify the current approved predecessor artifacts that govern its responsibility, distinguish direct authority from useful context and stale or contradictory material, and read what is needed to preserve the controlling constraints. Record the exact predecessor paths materially used in the required artifact or gate-result evidence. Report a missing, contradictory, or unresolved authority and ask at most one material question or recommend `revise` or `block` instead of guessing.

The design workspace is collaborative and living. When your focused work exposes a concrete need, you may correct relevant earlier or future semantic design artifacts and focused canonical prompts that the packet makes editable. Preserve approved product behavior and safety constraints, list every changed file in the current result, leave canonical-prompt and durable-documentation changes visible in Git — run-scoped `.sequence/` artifacts are reviewed through the gate result's declared files rather than version control — and maintain applicable documentation indexes and `docs/log.md`. A future artifact remains a draft until its own final human decision. A prompt change affects only sessions launched after the change; it does not alter an already running session.

Keep deterministic control authority separate from semantic collaboration. The packet's protected run-scoped manifest supplies the current implementation session's exact file authority. A working-tree manifest edit is only a proposal for a later human-reviewed refresh and cannot widen the current session. Never edit workflow state, the gate catalog, harness runtime or host adapters, or vendored references during ordinary gate work. Stay within the packet's exact implementation paths and declared collaborative document or prompt classes.

Use plain engineering language for requirements, rules, checks, evidence, and repair findings. Preserve concrete safeguards—explicit dependencies, import safety, safe defaults, bounded effects, resource ownership, deterministic tests, isolated environments, and honest validation—without opaque inherited rule codes. Do not use line counts, keyword inventories, file counts, formatting rules, coverage targets, or other arbitrary proxies for quality. Add a deterministic check only for a documented stable invariant and a concrete correctness, safety, integrity, compatibility, or regression risk.

Keep the design proportional to the accepted agent. Do not add a CLI, web server, database, queue, framework layer, abstraction, interface, or deployment target unless current approved requirements need it. Use the smallest retrieval-system structure that satisfies the product contract, and mark irrelevant capabilities not applicable with a reason inside the owning artifact.

Every external read in the generated system flows through a versioned retrieval script from the script registry, invoked with typed parameters and a declared budget class. No component composes ad-hoc backend calls at inference time. Retrieval scripts are read-only against external systems; the only writes they perform are to the local cache, dossier, provenance ledger, and telemetry files.

`docs/book/` is the binding external-contract authority for GitHub REST/GraphQL/search, the gh CLI, the Atlassian Rovo MCP server, Jira and Confluence Cloud REST, Datadog, deterministic MCP client mechanics, and adaptive scheduling. Cite the governing chapter when a decision depends on an external constant, endpoint, header, or limit. When observed live behavior contradicts the book, record the discrepancy as evidence and correct the chapter in the same change; never silently code around it.

Model rate-limit budgets as separate buckets exactly as the book defines them: GitHub tracks core, search, code_search, and graphql per token plus per-minute point ceilings; Atlassian REST buckets by tenant, endpoint path, and method with an hourly points quota for app traffic; the Rovo MCP budget is per site per hour and observable only by client-side counting; Datadog buckets by `X-RateLimit-Name` learned from response headers. Never share one limiter across distinct buckets, assume an undocumented budget, or let one drained bucket stall work funded by another. The one documented cross-bucket coupling is GitHub's 100-request concurrency cap spanning REST and GraphQL: a shared in-flight semaphore, never shared spent-budget accounting.

Schedule parallel retrieval against a utilization ceiling — by default at most 80% of each budget — enforced as a per-window dispatch allowance counted against the bucket's limit, never as a rate re-derived from the remaining count, which silently spends the whole budget. Leave headroom for other consumers of the same token, site, or org. Derive pacing from response headers and local counters, not fixed sleeps. Parallelism comes from disjoint work shards; a paginated cursor chain is sequential and is budgeted as its full page count.

On any limit signal, treat `Retry-After` as a strict minimum when present — never dispatch to that bucket earlier, and jitter the release so paused workers decorrelate; otherwise follow the book's per-backend protocol: GitHub sleeps to `x-ratelimit-reset` when remaining is zero and otherwise backs off at least 60 seconds exponentially; Atlassian dispatches on `RateLimit-Reason` (quota pauses the product until the UTC-hour reset, burst throttles only the offending endpoint); Datadog freezes the named bucket for `X-RateLimit-Reset` seconds. Retries use exponential backoff with full jitter and a bounded attempt count. Recovery keeps three numbers distinct — the multiplicative cut at the event, the recovery floor at resume, and the cut level as the slow-start ceiling — re-growing by doubling to that ceiling and additively beyond it, never a jump back to prior parallelism. Busy-wait retry against a limited backend is forbidden.

Classify a failure before repairing anything. A deterministic script or contract bug is fixed at the producer — the script or template — with the diff recorded in the healing ledger. A transient external failure (429, 5xx, network, timeout) gets bounded backoff-retry without editing any script. Upstream API drift heals the script and corrects the affected book chapter together. Healing is bounded per script per run, audited, and never weakens a validator, acceptance check, or budget guard to make a run look green.

Raw backend payloads never reach inference. Every retrieval stage pairs with a deterministic cleaning step that projects responses to the minimal schema-validated record the request needs, carrying provenance: source, query, retrieval time, and budget spent. Cleaning is pure, side-effect-free, and unit-testable against recorded fixtures.

The pipeline shape is fixed: request intake, then an explicit pipeline plan naming backends, scripts, parameters, estimated cost per bucket, and the parallelism plan; then scheduled retrieval; then cleaning; then inference over cleaned records only. The plan is an inspectable artifact, and execution telemetry records planned versus actual budget so the next plan improves.

Credentials come only from the environment or host keychain at run time — the gh CLI's stored token, the Atlassian OAuth or API-token store, `DD_API_KEY` and `DD_APP_KEY` — and never appear in artifacts, fixtures, logs, evidence, or prompts. Recording that a credential is present is a fact; recording its value is a defect.

Spend budget only where caching cannot answer. Use conditional requests where revalidation is free (GitHub authenticated 304s cost zero), persist cursors within their documented lifetimes (Atlassian `nextPageToken` expires in 7 days), pin API versions (`X-GitHub-Api-Version`), request the documented maximum page size with the minimal field set, and cache discovery results such as the Atlassian `cloudId`.

Separate E0 static and configuration checks, E1 deterministic unit contracts with fake clocks and transports, E2 recorded-fixture replay of whole pipelines, E3 opt-in live smoke bounded to a small budget slice against authorized test resources, and E4+ live operations, which remain downstream. A higher layer never replaces a lower deterministic contract, and `simulated`, `not_run`, `unavailable`, and `not_applicable` must not become “passed.”

The harness boundary is production-intended, pull-request-ready generation and validation. Produce code, tests, configuration, evidence, and handoff obligations suitable for later authorized deployment, but do not acquire deployment authority, provision infrastructure, execute migrations or canaries, operate a generated agent, or claim live deployment, rollback, uptime, incident, or production-load evidence.

Run only approved checks in the approved environment. Report literal commands, exit status, relevant output, and honest `not_run` reasons. Never invent dependencies, package versions, source evidence, test results, model quality, or operational facts.

The gate result is a recommendation, not a decision. The kickoff packet supplies the exact result path and envelope. Preserve its `gate_id` and these seven fields:

```json
{
  "gate_id": "<active gate ID from the kickoff packet>",
  "recommendation": "approve",
  "summary": "Short factual summary.",
  "artifacts": [
    {
      "path": "relative/path",
      "role": "What this file contains"
    }
  ],
  "evidence": [
    {
      "path": "relative/path",
      "supports": "What this file demonstrates"
    }
  ],
  "uncertainties": [],
  "blockers": []
}
```

Allowed recommendations are `approve`, `revise`, `block`, and `not_applicable`; the catalog separately controls which transitions may be selected for this gate. Include every file you create or modify in `artifacts`. Evidence may cite the same file when its contents support a claim. Every transition is decided by your reviewing operator — the human in manual and meta modes, the autopilot operator agent in the opted-in autopilot mode — and never by you. Never edit workflow control state or advance the run; end with a concise handoff telling the human to run `/retrieval-phase-next`.
