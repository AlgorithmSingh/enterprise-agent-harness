<!-- Source: https://github.com/atlassian/atlassian-mcp-server/issues/171 -->
<!-- Accessed: 2026-08-12 -->
<!-- NOTE: community bug report on the official Atlassian repo; observations are NOT Atlassian-confirmed -->

# Hitting 429 rate limits on Rovo MCP Server far below expected ~1000/hour (API token auth, Confluence) Summary

State: open. Created: 2026-05-29T09:40:37Z.

**Summary**

We're authenticating to the Atlassian Rovo MCP Server (`https://mcp.atlassian.com/v1/mcp`) using a **personal API token (Basic Auth)** and calling Confluence read tools. We expected an effective limit of at least ~1000 requests/hour, but we're hitting `429 Too Many Requests` after roughly 20 parallel calls, with only ~200–300 total calls made over a couple of hours. We'd like to understand what limit we're actually hitting and how it's calculated, because we can't find Rovo MCP–specific rate-limit numbers anywhere in the documentation.

**Setup**

- Endpoint: `https://mcp.atlassian.com/v1/mcp`
- Auth: personal API token via Basic Auth (base64 `email:api_token`)
- Token type: scoped token, app = **Rovo MCP**, expires 23 Apr 2026
- Token scopes:
  - `read:confluence:mcp`
  - `read:page:confluence`
  - `read:space:confluence`
  - `read:hierarchical-content:confluence`
  - `search:confluence`
  - `search:rovo:mcp`
- Primary tool being called: `getConfluencePage`
- Call pattern: bursts of ~20 parallel calls

**What we observe**

- Total calls to `getConfluencePage` over the measured window (May 22–29): **348**.
- Over a 24h window (May 28), calls were bursty — peaks of ~25–30 calls in a short interval — and we get `429`s on those bursts (we counted up to ~12 `429`s in a single peak interval).
- The `429`s line up directly with our concurrency spikes, not with sustained volume. Total volume was low (~200–300 over hours), well under what we'd expect from any per-hour limit.
- We've inspected the retry headers and only find a `Retry-After` value (seconds). We don't see `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-interval-seconds`, or `x-ratelimit-fillrate` that the Atlassian REST rate-limiting docs describe.

**Our questions**

1. What is the actual rate limit for the Rovo MCP Server when authenticating via **API token**? Is it a per-hour quota, a token-bucket / burst limit, a per-second concurrency cap, or something else? The public docs don't publish hard numbers for MCP calls.
2. Is the limit applied **per token**, **per user**, **per IP**, or **per org**? We want to know what the "1000/hour" figure we had in mind actually refers to, if anything.
3. Is there a **concurrency cap** independent of the volume quota? Our data strongly suggests we're being throttled on parallelism (~20 simultaneous calls), not on total requests.
4. Are there response headers we should be reading besides `Retry-After` to see remaining budget and refill timing? If so, what are their exact names for the MCP endpoint?
5. Do MCP tool calls route through the standard Confluence Cloud REST rate limiter, or does the MCP server impose its own separate limit on top?

**What we've already checked**

- Rovo MCP Server docs (auth/authorization, API token configuration, settings) — no rate-limit numbers.
- Claude/Anthropic-side limits — these appear to be a separate concern from the Atlassian server limit.
- `Retry-After` header — present, but only gives seconds, no quota detail.

**What we'd like**

Either documented rate-limit figures for the MCP endpoint under API token auth, or confirmation of whether this is a concurrency limit vs. a per-hour quota, so we can implement the right backoff/concurrency strategy.


<img width="902" height="104" alt="Image" src="https://github.com/user-attachments/assets/e3be6194-fcd0-4a13-9abc-1b8919e7e987" />

<img width="902" height="664" alt="Image" src="https://github.com/user-attachments/assets/3206649d-ba95-4502-a7c5-a7a39645da94" />

## Comments

### iosamaatlassian (COLLABORATOR) 2026-05-31T23:52:38Z

Thanks @JaswirStillWater for the detailed feedback. I will check with the team and get back to you on this.
