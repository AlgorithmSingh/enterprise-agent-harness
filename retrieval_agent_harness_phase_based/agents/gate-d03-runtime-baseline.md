---
description: Define the versioned runtime baseline and retrieval application contract
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

Own D03 runtime and retrieval application design. Begin with current-artifact discovery. Read `.sequence/design/01-repository-intake.json` for repository facts and `.sequence/design/02-outcome-acceptance.json` for the product contract. Preserve compatible existing runtime choices and expose conflicts instead of guessing or upgrading by default.

Define the target Python version and syntax floor, honoring existing repository pins and never dropping below what the selected dependencies require. Set the dependency policy with uv as the default manager: an isolated project environment, a committed `uv.lock`, and a `.python-version` interpreter pin. Select a coherent exact or bounded lock set for the HTTP client, the data-model and schema-validation library, the MCP client SDK, and any limiter or retry libraries the design adopts; cite every choice to current official authority with an access date, and never invent a package or version. Record literal setup, test, type-check, lint, format, and validation commands with honest unsupported or unconfigured states.

Read `docs/book/gh-cli-retrieval.md` and `docs/book/mcp-client-mechanics.md` as binding design authority for transport selection. GitHub retrieval invokes the gh CLI as a subprocess; gh performs no retries and no client-side throttling, so the scheduler owns all pacing, backoff, and retry for that backend. Atlassian Jira and Confluence flow through the Rovo MCP server via a deterministic MCP client — pin the Python SDK to the chapter's `mcp>=1.29,<2` v1 `ClientSession` era with explicit per-call timeouts and tool-error checking — and keep the documented REST fallback available. Datadog uses direct REST through the locked HTTP client.

In the same artifact define the smallest adequate application contract: the request intake boundary — a plain function or a CLI, whichever the approved requirements actually need; the pipeline planner and the schema of the inspectable pipeline plan it emits; the script registry holding versioned retrieval scripts; the scheduler executing the plan within budget buckets; the cleaning step yielding cleaned records; and the inference step boundary with an explicit no-provider fake mode so E1 tests run with no live model and no live backend. Give every component a stable name, typed input and output schemas, and defined refusal and bounded-error behavior. Do not add a component, wrapper, or interface merely because a library offers it.

Write only `.sequence/design/03-runtime-application-contract.json`. Give it clearly distinguishable sections for the Python and syntax baseline; the dependency policy and cited lock set; the literal command inventory; backend transport selection with governing book citations; the per-component application contract with names, schemas, and behavior; reasoned internal not-applicability entries; and uncertainties.

Leave backend request and payload contracts to D05, state and cache layout to D06, scheduling and budget detail to D07, and Python architecture to D09. Record an evidence-backed choice, reasoned internal not-applicability, or named uncertainty for every material decision. Write the generic result and recommend `approve`, `revise`, or `block`, never gate-level `not_applicable`; the human decides every transition.
