---
type: reference
title: "Adaptive Rate-Limit-Aware Parallel Scheduling"
description: "Verified provider rate-limit constants (GitHub, Atlassian, Datadog) and the client-side algorithms — header-driven pacing, token buckets, AIMD/Vegas concurrency control, full-jitter backoff, retry budgets, slow-start recovery, cost reduction, circuit breakers — that let a parallel retrieval scheduler run at, but never over, those limits."
timestamp: "2026-08-12"
---

# Adaptive Rate-Limit-Aware Parallel Scheduling

All constants in this chapter were read from pages fetched on 2026-08-12 (cached under `.web-docs/undefined-*.md`). Anything not seen in a fetched page is flagged "(unverified)". Utilization targets and similar tuning values that are design choices, not vendor numbers, are labeled "design heuristic".

## Overview

A deterministic retrieval pipeline fans hundreds of read calls out to GitHub, Atlassian (Jira/Confluence), and Datadog. Every one of those providers meters requests against per-principal budgets and answers overruns with 403/429 — and GitHub warns that "continuing to make requests while you are rate limited may result in the banning of your integration." The scheduler's job is therefore twofold:

1. **Stay under the limit proactively** — pace and parallelize using the budget the provider reports in response headers, not by trial and error.
2. **Recover intelligently when a limit is hit anyway** — honor `Retry-After`, back off with full jitter, cap retries with a retry budget, and re-grow parallelism slowly instead of jumping back to full fan-out.

The controlling insight is Little's Law as stated by the Netflix concurrency-limits README: `Limit = Average RPS * Average Latency`. A scheduler can steer either the request *rate* (token bucket paced from headers) or the *concurrency* (AIMD/Vegas window); this chapter gives verified constants and pseudocode for both, plus the cost-reduction levers (ETag, coalescing, GraphQL batching) that make any budget go further.

## Authentication

Which credential a request carries decides **which budget it draws from**. Only rate-limit-relevant authentication facts are listed here; full auth flows live in each backend's own chapter.

| Backend | Credential → budget mapping (verified) |
|---|---|
| GitHub REST | Unauthenticated: 60 req/h. Personal access token: 5,000 req/h (15,000 on Enterprise Cloud). GitHub App installation: 5,000/h base, +50/h per repo above 20 and per user above 20, cap 12,500/h (Enterprise: 15,000/h). `GITHUB_TOKEN` inside Actions: 1,000 req/h **per repository** (Enterprise: 15,000). |
| GitHub GraphQL | User: 5,000 points/h (Enterprise Cloud: 10,000). App installation: 5,000 points/h (Enterprise: 10,000). Actions `GITHUB_TOKEN`: 1,000 points/h per repository. |
| GitHub conditional requests | A `304 Not Modified` does not count against the primary limit only "if … the request was made while correctly authorized with an `Authorization` header" — anonymous 304s still cost budget. |
| Atlassian (Jira/Confluence Cloud) | Points quota is attached to the **app**, not the user: Tier 1 default is one global 65,000-point/h pool shared across every tenant of that app; only a reviewed Tier 2 allocation creates separate app-and-tenant pools. Burst buckets are independently keyed by tenant, endpoint, and method. API-token traffic does not spend the points quota. |
| Datadog | Limits are scoped **per endpoint at the organization, per-user, or per-API-key level** depending on the limit (Datadog's usage metrics report all three dimensions; the events limit is explicitly per org), so every script sharing the org — and especially the same key — draws from shared budgets. `X-RateLimit-Name` names the specific limit for support-ticket increase requests. (Exact auth header names for Datadog are covered in the Datadog chapter; not re-verified here.) |

Scheduler consequence: **budget identity = (provider, credential/tenant, resource bucket)**. Two pipelines using the same PAT, the same Datadog org, or the same Atlassian app share one budget and must share one pacer — reserve headroom for the other consumer (design heuristic; see utilization targets below).

## Retrieval surface

The scheduling-relevant surface is the set of ways to *observe* remaining budget cheaply.

| Backend | Surface | Invocation | Cost | Notes |
|---|---|---|---|---|
| GitHub REST | Headers on every response | read `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-used`, `x-ratelimit-reset`, `x-ratelimit-resource` | free (piggybacked) | `x-ratelimit-reset` is **UTC epoch seconds**; `x-ratelimit-resource` names the bucket the request counted against |
| GitHub REST | Dedicated endpoint | `GET https://api.github.com/rate_limit` | "does not count against your primary rate limit"; "can count against your secondary rate limit" | returns all resource buckets at once; docs still prefer headers |
| GitHub GraphQL | `rateLimit` object in any query | fields `limit`, `remaining`, `used`, `resetAt`, `cost` | docs recommend headers "when possible" | `cost` reports the point cost of the query carrying it |
| Datadog | Headers on every response | read `X-RateLimit-Limit`, `X-RateLimit-Period`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Name` | free (piggybacked) | `X-RateLimit-Reset` is **seconds until reset** (delta); `X-RateLimit-Period` is "calendar aligned"; no dedicated budget endpoint appears in the fetched doc |
| Jira / Confluence Cloud | Headers on responses | read `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-NearLimit`, `RateLimit-Reason`; on 429 also `Retry-After` | free (piggybacked) | `X-RateLimit-Reset` is an **ISO 8601 timestamp**; `X-RateLimit-NearLimit: true` fires when < 20% of capacity remains; `Beta-RateLimit-Policy` / `Beta-RateLimit` carry structured quota info (beta) |

Three different `*-Reset` semantics — GitHub epoch seconds, Datadog delta seconds, Atlassian ISO 8601 — must be normalized to one internal representation (absolute monotonic-clock deadline) before any pacing math.

## Pagination

Pagination multiplies request count, so it is a budget input, not a detail:

- GitHub REST: follow the `link` response header (`rel="next"`, `rel="prev"`, `rel="first"`, `rel="last"`) rather than constructing URLs. `per_page` maxes at 100 for most endpoints (silently clamped, no error); page selection is `page`, `before`/`after`, or `since` depending on endpoint. Example header (quoted from docs): `link: <https://api.github.com/repositories/1300192/issues?page=2>; rel="prev", <…?page=4>; rel="next", <…?page=515>; rel="last", <…?page=1>; rel="first"`.
- GitHub Search: hard cap of 1,000 results per search, default 30 per page, max 100 — so a full search drain is at most 10 requests at `per_page=100`, and search has its own per-minute budget (below).
- GitHub GraphQL: point cost is computed from connection `first`/`last` arguments (sum of requests needed for each unique connection ÷ 100, rounded, minimum 1), and no call may request more than 500,000 total nodes — page size directly sets query cost.
- Scheduler rule: always request the maximum page size the payload budget allows (`per_page=100`), since N pages cost N requests/points regardless of page fill.
- Jira/Confluence and Datadog pagination mechanics are covered in their own chapters (not re-verified here).

## Rate limits

### GitHub — primary limits (per hour, fixed window)

| Principal | REST req/h | GraphQL points/h |
|---|---|---|
| Unauthenticated | 60 | — |
| User (PAT / OAuth user token) | 5,000 | 5,000 |
| User on Enterprise Cloud | 15,000 | 10,000 |
| GitHub App installation | 5,000 base, +50 per repo > 20 and per user > 20, cap 12,500 | 5,000 (+bonuses) |
| App installation, Enterprise Cloud | 15,000 | 10,000 |
| OAuth app (client ID/secret) | 5,000 (15,000 Enterprise) | 5,000 (10,000 Enterprise-owned) |
| Actions `GITHUB_TOKEN` | 1,000 per repo (15,000 Enterprise) | 1,000 per repo (15,000 enterprise resources) |

### GitHub — search buckets (per minute, separate from core)

| Endpoint class | Limit |
|---|---|
| All search endpoints except code search, authenticated | 30 req/min |
| Code search (auth required) | 10 req/min |
| Search, unauthenticated | 10 req/min |

### GitHub — secondary limits (all concurrent with primary)

| Constraint | Value |
|---|---|
| Concurrent requests (REST + GraphQL combined) | ≤ 100 |
| REST points/min ("to a single endpoint per minute") | ≤ 900 per canonical REST endpoint/route |
| GraphQL points/min | ≤ 2,000 |
| CPU time | ≤ 90 s CPU per 60 s real time (GraphQL portion ≤ 60 s) |
| Content-generating requests | ≤ 80/min and ≤ 500/h |
| OAuth token requests | ≤ 2,000/h |

Secondary point values: REST `GET`/`HEAD`/`OPTIONS` = 1, REST `POST`/`PATCH`/`PUT`/`DELETE` = 5, GraphQL without mutations = 1, with mutations = 5 (some endpoints have undisclosed costs).

Buckets are separate budgets: `x-ratelimit-resource` (and the `resources` object of `GET /rate_limit`) distinguishes them — exhausting search does not touch core, and vice versa. GraphQL has its own points pool.

### Atlassian (Jira Cloud; Confluence Cloud mirrors the model)

Three simultaneous, independent systems (docs accessed 2026-08-12):

| System | Limit |
|---|---|
| Points quota, Tier 1 global pool (default) | 65,000 points/h shared across all tenants of the app |
| Points quota, Tier 2 per-tenant | Standard 100,000 + 10×users; Premium 130,000 + 20×users; Enterprise 150,000 + 30×users; cap 500,000 points/h |
| Point costs | core-object GET = 1; identity/access GET = 2; writes = 1; unlisted objects default 1 |
| Burst limits (per second, token bucket, per endpoint) | GET 100 rps, POST 100 rps, PUT 50 rps, DELETE 50 rps; custom endpoints 5–500 rps |
| Per-issue writes | 20 writes / 2 s and 100 writes / 30 s per issue |

### Datadog

| Item | Value |
|---|---|
| Scope | per endpoint, enforced at org, per-user, or per-API-key level depending on the limit (events limit is per org); increases via support ticket (name the limit from `X-RateLimit-Name`); hard SaaS ceiling exists |
| Metric submission | not rate limited |
| Log send API | not rate limited |
| Events | 250,000 events/min per org |
| Everything else | limited, numbers undisclosed — observable only via response headers |

### Error-code semantics and Retry-After

| Backend | On limit | Semantics |
|---|---|---|
| GitHub primary | **403 or 429** | `x-ratelimit-remaining: 0`; do not retry until `x-ratelimit-reset` (UTC epoch seconds) |
| GitHub secondary | **403 or 429** + error message | if `retry-after` present, do not retry before that deadline and use any longer computed backoff; else if `x-ratelimit-remaining` is 0, wait until `x-ratelimit-reset`; else wait ≥ 1 minute and back off exponentially. Persisting anyway risks integration ban |
| Jira/Confluence | **429**; **503** for transient failures (may carry `Retry-After`) | `Retry-After` = seconds to wait; `RateLimit-Reason` says which system tripped (`jira-quota-global-based`, `jira-burst-based`, `jira-per-issue-on-write`, `confluence-quota-global-based`); Atlassian: "If present, use the `Retry-After` header value as the minimum delay" |
| Datadog | **429** | wait `X-RateLimit-Reset` seconds (delta) |

Cheapest budget observation, in order: (1) parse headers of responses you were making anyway — free everywhere; (2) Jira `X-RateLimit-NearLimit: true` as an early-warning bit at < 20% remaining; (3) GitHub `GET /rate_limit` when idle-probing (free on primary, counts on secondary); (4) GraphQL `rateLimit` object piggybacked on a real query.

## Scheduling algorithms

### Header-driven budget pacing

Enforce the utilization ceiling as a **per-window dispatch allowance counted against the window's `limit`**, not as a rate re-derived from `remaining`. The tempting formula `rate = remaining × UTILIZATION / window` is a silent bug: because it re-derives from `remaining` on every response it decays asymptotically but *integrates to nearly the whole budget* — measured on a synthetic full window it spends ~99% of `limit` while claiming an 80% ceiling, never trips a 429, and surfaces only as a drained co-tenant budget (verified in `.prototype/001-rate-limit-scheduler/`). Cap utilization below 100% (design heuristic: 80–90%) and subtract a fixed reserve for other consumers of the same token/org/app. Atlassian's own `X-RateLimit-NearLimit` corroborates the threshold choice: it warns exactly when less than 20% of capacity remains, i.e. at 80% utilization.

```
# design-heuristic parameters
UTILIZATION = 0.85          # stay at 80-90% of budget
RESERVE     = 200           # requests/window held back for co-tenants of this token

def on_response(headers, provider):
    limit     = int(headers["<limit-header>"])              # x-ratelimit-limit / X-RateLimit-Limit
    remaining = int(headers["<remaining-header>"])          # x-ratelimit-remaining / X-RateLimit-Remaining
    reset_deadline = normalize_reset(headers, provider)
    #   github:   epoch_seconds(x-ratelimit-reset)
    #   datadog:  now + seconds(X-RateLimit-Reset)          # delta!
    #   atlassian: parse_iso8601(X-RateLimit-Reset)
    window    = max(reset_deadline - now(), 1.0)
    used      = limit - remaining                            # spent by everyone sharing the bucket
    allowance = max(limit * UTILIZATION - RESERVE - used, 0) # dispatches left in THIS window
    pacer[bucket_key(provider, headers)].set_rate(allowance / window)   # req per second
    if headers.get("X-RateLimit-NearLimit") == "true":               # atlassian early warning
        pacer[bucket_key(provider, headers)].scale(0.5)
```

The invariant to test is a **count**, not a rate: at most `limit × UTILIZATION − RESERVE` dispatches per window per bucket. Fixed-window caveat: GitHub windows are hourly and Datadog periods are "calendar aligned"; recompute the allowance on every response (`used` also captures co-tenant spending), and never precompute a whole-window schedule. Headers expose the reset *instant*, never the window *length* — a scheduler learns the length only after observing a reset boundary, so it needs a configured default window per provider (e.g. 3600 s for GitHub) for rollover decisions between responses.

### Token-bucket client throttle with per-resource buckets

Enforce the paced rate with a token bucket per **bucket key**, never a single global one, because providers meter buckets independently:

- GitHub: `core`, `search`, `code_search`, `graphql`, … — key on `x-ratelimit-resource` from live responses (plus a process-wide semaphore of ≤ 100 concurrent requests across REST *and* GraphQL).
- Atlassian: per (tenant, endpoint, method) for burst limits — Atlassian describes these as token buckets server-side — plus one app-global points bucket for default Tier 1 or separate (app, tenant) buckets only for approved Tier 2, plus a per-issue write bucket.
- Datadog: per `X-RateLimit-Name` family within the org.

```
class TokenBucket:
    def __init__(self, rate, burst):
        self.rate, self.burst = rate, burst      # tokens/sec, max tokens
        self.tokens, self.last = burst, now()
    def acquire(self, n=1):                      # blocks the worker, not the event loop
        while True:
            self.tokens = min(self.burst, self.tokens + (now() - self.last) * self.rate)
            self.last = now()
            if self.tokens >= n:
                self.tokens -= n; return
            sleep((n - self.tokens) / self.rate)

buckets = {}   # key -> TokenBucket
def bucket_key(provider, req):
    if provider == "github":   return ("github", resource_of(req))   # core|search|code_search|graphql
    if provider == "atlassian":return ("atl", req.tenant, req.endpoint, req.method)
    if provider == "datadog":  return ("dd", limit_name_of(req))     # learned from X-RateLimit-Name

def issue(req):
    buckets[bucket_key(req.provider, req)].acquire(cost(req))        # cost: e.g. GitHub secondary 1 GET / 5 write
    with github_concurrency_semaphore(100):                          # provider-wide cap
        return http(req)
```

### Adaptive concurrency control: AIMD vs. latency-gradient

Two families, per the Netflix concurrency-limits library:

- **AIMD** (additive-increase, multiplicative-decrease) reacts to explicit *failure* signals — drops, timeouts, 429s. Netflix `AIMDLimit` defaults (read from source): `initialLimit = 20`, `minLimit = 20`, `maxLimit = 200`, `backoffRatio = 0.9`, timeout 5 s; decrease `limit ×= backoffRatio` when a request dropped or RTT exceeded the timeout, increase `limit += 1` only when `inflight * 2 >= currentLimit` (the window is actually being used), clamp to `[minLimit, maxLimit]`. **Appropriate when**: the backend gives you crisp overload signals (HTTP 429/`Retry-After`, as all three providers here do) and latency is noisy or dominated by payload size — the normal case for a retrieval scheduler hitting SaaS APIs.
- **Vegas / Gradient2** (latency-based) infer queueing *before* failures: Vegas estimates the queue as `L * (1 - minRTT/sampleRtt)`, growing the limit by 1 per sampling window while the estimate is below alpha (2–3 requests) and shrinking by 1 above beta (4–6); Gradient2 compares short- vs long-window exponential latency averages and cuts the limit aggressively when they diverge. **Appropriate when**: you get no honest 429s (limits enforced by silent queueing/slowdown), or you are protecting a backend you own where RTT inflation is the earliest overload signal. Latency-based limits need a stable RTT baseline; bursty, heterogeneous retrieval traffic biases minRTT (the problem Gradient2 exists to soften).

For this harness: AIMD on the outer scheduler (providers speak 429 fluently), Vegas/Gradient2 style only for internal stages without explicit backpressure.

```
# AIMD window mirroring Netflix defaults
limit, min_l, max_l, backoff = 20, 20, 200, 0.9
def on_sample(inflight, rtt, dropped):          # dropped := 429/403-rate-limit/timeout
    global limit
    if dropped or rtt > 5.0:
        limit = int(limit * backoff)            # multiplicative decrease
    elif inflight * 2 >= limit:
        limit = limit + 1                       # additive increase, only if window is used
    limit = min(max_l, max(min_l, limit))
# workers: run while inflight < min(limit, provider_concurrency_cap)  e.g. GitHub cap 100
```

### Backoff: exponential with full jitter, under a retry budget

The AWS Architecture Blog compared jitter strategies for contending clients: plain exponential backoff (`sleep = min(cap, base * 2^attempt)`) synchronizes retries into spikes; **full jitter** — `sleep = random(0, min(cap, base * 2^attempt))` — gave the least total work with completion time competitive with the best; **equal jitter** (half deterministic, half random) was "the loser" on completion time while saving no calls versus full jitter, which is why full jitter beats it: you pay equal jitter's guaranteed minimum wait without any reduction in contention. Decorrelated jitter (`sleep = min(cap, random(base, 3 * previous_sleep))` — the random range starts at `base`, not 0) used slightly more calls. The article's verdict: jittered backoff "should be considered a standard approach for remote clients."

Retry volume must also be capped (Google SRE Book, "Handling Overload"): at most **3 attempts per request**, and retries may be at most **10% of total request volume per client**; attempt counts ride in request metadata (0–2) so a backend can answer "overloaded; don't retry". Layer on adaptive client throttling: track `requests` and `accepts` over a 2-minute window and reject locally once `requests > K × accepts` (standard **K = 2**; smaller K, e.g. 1.1, throttles more aggressively).

Precedence rule, verified on all three providers: **an explicit `Retry-After` (or GitHub `x-ratelimit-reset` with `remaining: 0`) always overrides computed backoff** — GitHub: don't retry before it; Atlassian: use it "as the minimum delay"; equivalently `sleep = max(retry_after, jittered_backoff)`.

```
BASE, CAP, MAX_ATTEMPTS = 1.0, 60.0, 3          # MAX_ATTEMPTS per SRE book
retry_tokens = TokenBucket(rate=0.1 * observed_request_rate, burst=B)  # <=10% retry budget

def send_with_retry(req):
    for attempt in range(MAX_ATTEMPTS):
        resp = issue(req)
        if not is_retryable(resp):                 return resp
        if resp.status in (403, 429, 503):
            wait = full_jitter(attempt)            # random(0, min(CAP, BASE * 2**attempt))
            if resp.headers.get("retry-after"):
                wait = max(wait, float(resp.headers["retry-after"]))          # Retry-After wins
            elif remaining_is_zero(resp):
                wait = max(wait, reset_deadline(resp) - now())                # sleep to reset
            if attempt + 1 < MAX_ATTEMPTS and retry_tokens.try_acquire(1):
                sleep(wait); continue
        return resp                                # budget exhausted -> fail upward, no retry
```

### Rescaling after backoff: slow start, not full jump

After a rate-limit event, resuming at the previous parallelism usually re-trips the limit immediately (the window that rejected you is still mostly spent) and synchronized resume is exactly the retry-storm pattern the SRE Workbook's Pokémon GO case study warns about (client retry storms compounding overload at 50× projected demand). Recovery discipline, borrowing TCP congestion-control shape via the Netflix library's model:

Three distinct numbers govern recovery — conflating them recreates the instant-jump this section forbids (verified in `.prototype/001-rate-limit-scheduler/`):

- The **cut factor** at the event (AIMD's `× 0.9`, or harder — halve — when `Retry-After` was long); the cut value becomes the **slow-start ceiling** (TCP's `ssthresh`), and the scheduler drains to the reset deadline if `remaining` hit 0.
- The **recovery floor** at resume: restart concurrency at `minLimit`/a small fraction — not at the cut value — then double per success epoch up to the slow-start ceiling, then re-grow additively (+1 per success interval) beyond it. Example from 8 workers: cut to 4 at the event, resume at 1, slow-start `1→2→4`, then additive `5→6→7→8`; the prior level returns after six success epochs, never in one step.
- Re-entry itself is jittered so parallel workers don't un-pause simultaneously.

```
def after_rate_limit_event(sched, resp):
    sched.ssthresh = max(sched.min_limit, int(sched.limit * 0.5))  # cut; harder than steady-state 0.9
    sched.pause_until(max(retry_after_deadline(resp), reset_deadline(resp)))
def on_resume(sched):
    sched.limit = sched.min_limit                                # recovery floor
    sched.growth_mode = SLOW_START                               # double per epoch until ssthresh,
                                                                 # then ADDITIVE (+1 per healthy interval)
    sleep(random(0, RESUME_JITTER))                              # decorrelate workers
```

### Cost reduction: spend fewer points for the same bytes

Levers, each verified against provider docs:

1. **Conditional requests (ETag / Last-Modified)** — GitHub: send saved `etag` as `if-none-match` (or `last-modified` as `if-modified-since`); a `304 Not Modified` "does not count against your primary rate limit" when the request carried a valid `Authorization` header. A well-primed cache turns steady-state polling nearly free. Keep sort orders and query parameters stable to maximize 304 hits.
2. **Response caching** — cache bodies keyed by (URL, params, auth principal) with the ETag alongside; revalidate with the conditional request instead of refetching.
3. **Request coalescing / dedup** — singleflight semantics: "only one execution is in-flight for a given key at a time. If a duplicate comes in, the duplicate caller waits for the original to complete and receives the same results." Fan-out retrieval plans routinely request the same repo/issue/monitor from multiple branches; coalescing makes N concurrent identical fetches cost 1.
4. **GraphQL batching** — one GraphQL query with nested connections replaces many REST calls, and the point formula rewards it: cost = (sum of connection requests at declared `first`/`last`) ÷ 100, minimum 1 — e.g. fetching 100 items via one connection costs ~1 point versus 100 separate REST requests. Bound by the 500,000-node ceiling per call and the 2,000 GraphQL points/min secondary limit.
5. **Field selection / minimal payloads** — GraphQL requests only named fields by construction; REST: `per_page=100` to minimize page count. (GitHub REST has no general sparse-fieldset parameter in the fetched docs; per-endpoint filters live in the backend chapters.) Smaller CPU-per-request also protects GitHub's 90 s CPU / 60 s real-time secondary limit.

```
def fetch(url, params, auth):
    key = (url, frozen(params), auth.principal)
    return coalesce.Do(key, lambda: _fetch_revalidating(key))    # singleflight

def _fetch_revalidating(key):
    entry = cache.get(key)
    hdrs = {"if-none-match": entry.etag} if entry else {}
    resp = send_with_retry(request(key, headers=hdrs))
    if resp.status == 304:                      # free on GitHub primary when authorized
        return entry.body
    cache.put(key, body=resp.body, etag=resp.headers.get("etag"))
    return resp.body
```

### Circuit breakers: when to fail a stage vs. degrade

The circuit breaker (Fowler) wraps each (provider, bucket) client: **closed** → count failures (successes reset the counter); at the threshold the breaker "trips" **open** and calls fail immediately without touching the wire, which "reduce[s] resources tied up in operations which are likely to fail"; after a reset timeout, **half-open** lets one trial call through — success closes, failure re-opens. "Any change in breaker state should be logged."

Rate-limit specificity: a 429 with `Retry-After` is a *scheduling* signal (pause the bucket's pacer), not a *health* signal — don't trip the breaker on it. Trip on repeated 5xx, timeouts, or 429s that persist after honoring `Retry-After` (which suggests another consumer is draining the shared budget).

Fail vs. degrade — decide per stage using SRE criticality vocabulary (CRITICAL_PLUS / CRITICAL / SHEDDABLE_PLUS / SHEDDABLE, where SHEDDABLE_PLUS is the default for batch jobs):

- **Degrade** when the stage is SHEDDABLE(_PLUS): serve stale cache with a staleness marker, narrow the field set, skip enrichment lookups, or emit partial results with an explicit gap manifest.
- **Fail the stage** when it is CRITICAL for downstream correctness (e.g. the retrieval that determines what to mutate): a deterministic pipeline must prefer a clean, resumable failure over silently incomplete input. Fowler: "clients using them need to react to breaker failures" — the reaction must be designed, not defaulted.

```
class Breaker:                                  # per (provider, bucket)
    state, failures = CLOSED, 0
    THRESHOLD, RESET_TIMEOUT = 5, 30.0          # threshold 5 per Fowler's example; timeout: design heuristic
    def call(self, fn):
        if self.state == OPEN:
            if now() < self.opened_at + self.RESET_TIMEOUT: raise BreakerOpen
            self.state = HALF_OPEN              # allow one trial
        try:
            r = fn()
            self.failures, self.state = 0, CLOSED
            return r
        except RetryableFailure:
            self.failures += 1
            if self.state == HALF_OPEN or self.failures >= self.THRESHOLD:
                self.state, self.opened_at = OPEN, now()
                log("breaker OPEN", self.key)   # state changes must be logged
            raise

def run_stage(stage):
    try:  return stage.run()
    except BreakerOpen:
        if stage.criticality in (SHEDDABLE, SHEDDABLE_PLUS): return stage.degraded_result()
        raise StageFailed(stage, resumable=True)             # CRITICAL: fail clean
```

## Deterministic retrieval recipes

Observe GitHub budget without spending primary quota (`gh` and raw curl):

```bash
# All buckets at once; free on the primary limit (can count on secondary)
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Accept: application/vnd.github+json" \
     https://api.github.com/rate_limit \
| jq -c '.resources | {core, search, code_search, graphql}'

# Same via gh
gh api rate_limit --jq '.resources | {core, search, graphql}'
```

Read GitHub budget headers piggybacked on any request (zero extra cost):

```bash
curl -s -o /dev/null -D - -H "Authorization: Bearer $GITHUB_TOKEN" \
     "https://api.github.com/repos/OWNER/REPO/issues?per_page=100" \
| tr -d '\r' | grep -i '^x-ratelimit-' 
# x-ratelimit-limit / -remaining / -used / -reset (UTC epoch s) / -resource
```

GraphQL budget probe attached to a real query (reports the query's own cost):

```bash
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" -X POST https://api.github.com/graphql \
  -d '{"query":"query { rateLimit { limit remaining used resetAt cost } }"}' \
| jq -c '.data.rateLimit'
```

Conditional request loop (304 is free on the primary limit when authorized):

```bash
ETAG=$(curl -s -D - -o body.json -H "Authorization: Bearer $GITHUB_TOKEN" \
       "https://api.github.com/repos/OWNER/REPO" | tr -d '\r' | awk -F': ' 'tolower($1)=="etag"{print $2}')
curl -s -o /dev/null -w '%{http_code}\n' \
     -H "Authorization: Bearer $GITHUB_TOKEN" -H "If-None-Match: $ETAG" \
     "https://api.github.com/repos/OWNER/REPO"     # -> 304 when unchanged
```

Observe Datadog / Atlassian budgets from headers of any GET you already make (endpoint paths belong to those backends' chapters):

```bash
# Datadog: note X-RateLimit-Reset is a DELTA in seconds
curl -s -o /dev/null -D - <any Datadog API GET with your auth headers> \
| tr -d '\r' | grep -i '^x-ratelimit-'

# Jira/Confluence Cloud: X-RateLimit-Reset is ISO 8601; watch NearLimit
curl -s -o /dev/null -D - <any Jira Cloud REST GET with your auth> \
| tr -d '\r' | grep -iE '^(x-ratelimit-|ratelimit-reason|retry-after)'
```

## Scheduler implications

Hard constraints a rate-limit-aware parallel scheduler must respect:

- **One pacer per budget identity** (provider × credential/tenant/org × resource bucket). GitHub `core`, `search`, `code_search`, and `graphql` are separate primary budgets (`x-ratelimit-resource`), while the 900-point secondary REST budget is keyed by canonical endpoint and the GraphQL minute budget by its one endpoint. Atlassian uses one app-global Tier 1 points pool or approved app-and-tenant Tier 2 pools, plus tenant/endpoint/method burst and per-issue write buckets. Datadog meters per `X-RateLimit-Name` family at org, per-user, or per-API-key scope depending on the limit.
- **GitHub global concurrency cap: never more than 100 requests in flight** across REST and GraphQL combined — enforce with a process-wide semaphore; GitHub's own best practice for avoiding secondary limits is serial requests through a queue.
- **GitHub secondary throughput caps**: ≤ 900 REST points/min to each canonical endpoint and ≤ 2,000 GraphQL points/min, with writes costing 5 points vs 1 for reads and some REST endpoint costs undisclosed. Track these windows client-side because GitHub exposes no secondary-budget status; content-generating requests are further capped at 80/min, 500/h.
- **`Retry-After` (and `x-ratelimit-reset` at `remaining: 0`) overrides every computed backoff** — sleep at least that long, never less; treat it as a minimum (Atlassian's explicit rule).
- **When `remaining` hits 0, stop the bucket entirely until the reset deadline** — GitHub warns continued requests can get the integration banned.
- **Normalize reset semantics before doing math**: GitHub = UTC epoch seconds; Datadog = delta seconds until reset (period is calendar-aligned); Atlassian = ISO 8601 timestamp. Mixing them corrupts every pacing computation downstream.
- **Utilization ceiling below 100%** (design heuristic 80–90%) with a reserved slice for other consumers of the same token/app/org; treat Atlassian `X-RateLimit-NearLimit: true` (< 20% left) as a mandatory throttle-down signal.
- **Retry ceilings**: ≤ 3 attempts per request; retries ≤ 10% of total request volume; use full jitter `random(0, min(cap, base·2^attempt))`; client-side adaptive throttling once `requests > 2 × accepts` in the trailing 2 minutes.
- **Slow-start after any limit event**: multiplicative cut immediately, additive re-growth from the floor, jittered resume — never rejoin at prior parallelism.
- **Never schedule unauthenticated GitHub calls** in a pipeline: 60/h versus 5,000/h, and anonymous 304s aren't free.
- **Search is scarce**: GitHub search = 30 req/min (code search 10 req/min), 1,000-result cap per query — schedule search calls from a dedicated low-rate bucket and design queries to fit the cap.
- **Atlassian write pipelines must serialize per issue**: 20 writes/2 s and 100 writes/30 s per issue regardless of remaining points.
- **GraphQL queries must stay under 500,000 nodes** and should batch REST fan-outs (cost ≈ connections/100, min 1) — but batching concentrates failure: one 429 now blocks N logical fetches, so cap batch size by blast radius too.

## Failure modes and healing signals

| Wire signature | Diagnosis | Healing action for a script-healing agent |
|---|---|---|
| GitHub 403 **or** 429, `x-ratelimit-remaining: 0`, `x-ratelimit-resource: <bucket>` | Primary budget of that bucket exhausted | Freeze only that bucket's pacer until `x-ratelimit-reset` (epoch s); let other buckets continue; on resume, slow-start. Verify with free `GET /rate_limit` |
| GitHub 403/429 **with `retry-after`** and an error message, while `x-ratelimit-remaining` > 0 | Secondary limit (concurrency, points/min, CPU, or content-creation) | Do not retry before `retry-after`; use any longer jittered backoff and jitter re-entry, halve concurrency, and if it recurs drop to serial queued requests; check for a concurrent-workers bug (> 100 in flight) |
| GitHub 200 but `x-ratelimit-remaining` falling faster than the scheduler's own accounting | Another consumer shares the token | Increase RESERVE, lower utilization target; alert owner to split credentials |
| GitHub 304 Not Modified | Conditional hit — content unchanged | Serve cache; confirm request was authorized (anonymous 304s still spend budget); no retry logic involved |
| Jira/Confluence 429, `Retry-After: <s>`, `RateLimit-Reason: jira-burst-based` | Per-endpoint per-second burst bucket emptied | Sleep ≥ `Retry-After`; lower that endpoint's token-bucket rate (defaults: GET/POST 100 rps, PUT/DELETE 50 rps are ceilings, not entitlements) |
| Jira 429 with `RateLimit-Reason: jira-quota-global-based` | Hourly points pool (possibly the 65,000/h all-tenant global pool) exhausted | Long pause until `X-RateLimit-Reset` (ISO 8601); reduce point spend (batch, cache); if chronic, the fix is Tier-2 per-tenant quota, not retries |
| Jira 429 with `RateLimit-Reason: jira-per-issue-on-write` | > 20 writes/2 s or > 100 writes/30 s on one issue | Serialize writes per issue key; coalesce field updates into fewer write calls |
| Jira/Confluence 503 with `Retry-After` | Transient platform failure, not quota | Retry after the header value with full jitter, within the 3-attempt / 10% retry budget; do not touch pacer state |
| Any response with `X-RateLimit-NearLimit: true` (Atlassian) | < 20% of window capacity left | Proactively halve the pacer now — cheaper than reacting to the coming 429 |
| Datadog 429, `X-RateLimit-Reset: <delta s>`, `X-RateLimit-Name: <family>` | That endpoint family's budget (org-, user-, or key-scoped) exhausted | Sleep the delta; pace that family separately; if structural, request an increase citing `X-RateLimit-Name`. Remember other consumers of the org/key share the budget |
| Timeouts / 5xx bursts without rate-limit headers | Provider incident, not quota | Circuit breaker path: trip after threshold, half-open probe, degrade SHEDDABLE stages (stale cache + gap manifest), fail CRITICAL stages cleanly and resumably |
| Client-side: retry volume > 10% of requests, or `requests > 2 × accepts` over 2 min | Retry storm forming (Pokémon GO pattern) | Stop retrying at this layer; reject locally (adaptive throttling); surface backpressure to the planner instead of the wire |
| Exit-code mapping for pipeline runners (design heuristic) | — | Distinguish at minimum: success; rate-limited-and-deadline-known (retryable, machine-readable resume-at timestamp); breaker-open/incident (retryable, unknown deadline); non-retryable (4xx logic error) |

## Sources

All fetched 2026-08-12; extraction caches in `.web-docs/` (filenames `undefined-<slug>.md`).

| URL | Grounded |
|---|---|
| https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ | Backoff/jitter formulas, full-vs-equal-vs-decorrelated comparison, full-jitter recommendation |
| https://github.com/Netflix/concurrency-limits (+ raw README) | Little's Law framing, Vegas formula and alpha/beta, Gradient2 mechanism, limiter/partition patterns |
| https://raw.githubusercontent.com/Netflix/concurrency-limits/master/concurrency-limits-core/src/main/java/com/netflix/concurrency/limits/limit/AIMDLimit.java | AIMD defaults (20/20/200, backoffRatio 0.9, 5 s timeout) and exact increase/decrease conditions |
| https://sre.google/workbook/managing-load/ | Load shedding/autoscaling context; Pokémon GO retry-storm case study; pointer that retry budgets live elsewhere |
| https://sre.google/sre-book/handling-overload/ | Adaptive client throttling (K=2, 2-min window), retry budgets (3 attempts, 10%), criticality levels |
| https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api | All GitHub primary/secondary numbers, header names, 403-or-429 semantics, /rate_limit cost, ban warning |
| https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api | retry-after/reset handling order, serial-requests guidance, ETag/Last-Modified flows, 304-not-counted rule |
| https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api | Link header format, per_page max 100, page/before/after/since parameters |
| https://docs.github.com/en/rest/search/search?apiVersion=2026-03-10 | Search 30/min, code search 10/min, unauthenticated 10/min, 1,000-result cap |
| https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api | GraphQL points/hour by principal, point formula (÷100, min 1), 500,000-node limit, rateLimit fields |
| https://developer.atlassian.com/cloud/jira/platform/rate-limiting/ | Jira per-tenant scope, points tiers (65,000 global; 100k–150k+users; 500k cap), burst rps, per-issue writes, headers incl. NearLimit/RateLimit-Reason, Retry-After-as-minimum, recommended backoff constants |
| https://developer.atlassian.com/cloud/confluence/rate-limiting/ | Confluence global-pool quota (65,000/h), same header family, confluence-quota-global-based reason |
| https://docs.datadoghq.com/api/latest/rate-limits/ | Datadog X-RateLimit-* header names/semantics (Reset = delta seconds), 429, org scope, events 250k/min, unlimited metric/log intake |
| https://martinfowler.com/bliki/CircuitBreaker.html | Breaker states/transitions, threshold/reset-timeout mechanics, logging and fallback guidance |
| https://pkg.go.dev/golang.org/x/sync/singleflight | Request-coalescing semantics (single in-flight execution per key, shared results) |

Fetch-fidelity note: pages were captured via a summarizing fetch tool. The decorrelated-jitter lower bound, ambiguous in the original capture, was re-verified against the live AWS page on 2026-08-12: `sleep = min(cap, random_between(base, sleep * 3))` — the lower bound is `base`. https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ redirects to builder.aws.com, which served no extractable content; nothing in this chapter relies on it.
