# Prototype 001 — Rate-limit scheduler contract

Prototype-assisted design instrument for gate **D07**. This is a design probe,
not production implementation. `.prototype/` is a disposable scratchpad: it is
deliberately outside `docs/`, carries no OKF frontmatter, and is not registered
in `docs/index.md` or `docs/log.md`.

## Question

Is the scheduler contract D07 will prescribe — one limiter per budget bucket,
header-driven budget tracking, a configurable utilization ceiling (default 0.8),
AIMD concurrency with slow-start recovery, exponential backoff with full jitter,
and `Retry-After` taking precedence over computed backoff — implementable as one
small deterministic Python module (stdlib only) whose every timing behavior is
testable with an injected fake clock and injected randomness?

**Answer: yes**, at 228 lines of code, with all timing deterministic. But four
clauses of the contract as stated are wrong or underspecified, and one of them
(the utilization ceiling) silently fails to do what it says.

## Provisional contract

As implemented in `spike/scheduler.py`:

- **Budget identity.** One `_BucketRuntime` per bucket key, created lazily.
  Buckets share exactly one thing: the global in-flight cap.
- **Observation.** `Event(kind, limit, remaining, reset_at, retry_after)` — a
  header-style observation whose `reset_at` is already normalized to the
  caller's clock. Provider-specific reset semantics are an adapter's job.
- **Two entry points, not one.** `observe(now, bucket, event)` folds in a
  completed request and releases an in-flight slot; `decide(now, bucket,
  event=None)` optionally observes, then returns an `Action`.
- **Action.** `DISPATCH | HOLD | BACKOFF` plus `not_before` and a `reason`
  (`concurrency`, `global_concurrency`, `cold_start_probe`, `budget_exhausted`,
  `pacing`, `backoff`).
- **Utilization ceiling.** A per-window *allowance*, `limit * utilization -
  reserve`, spent against `used = (limit - remaining) + in_flight`.
- **Pacing.** Token bucket at `remaining_allowance / window_left`, burst-capped.
- **Concurrency.** AIMD: `+1` per success epoch (gated on `in_flight * 2 >=
  limit`), `× 0.5` on a limit event, TCP-shaped recovery.
- **Backoff.** `max(retry_after, full_jitter(attempt))`, or
  `max(reset_at - now, full_jitter(attempt))` when `remaining == 0`.

Determinism seams: **time is a parameter of every public method** (no clock
object at all), and randomness is one injected `Callable[[], float]`.

## What was tested

`spike/test_scheduler.py`, 22 tests, stdlib `unittest`, no network, no real
clock, no real randomness, no filesystem.

| Required property | Tests |
|---|---|
| (1) Dispatch rate never exceeds ceiling × budget in a window | `test_hard_ceiling_is_exactly_utilization_times_limit` (exactly 80 of 100, then `budget_exhausted`), `test_paced_dispatch_over_a_window_stays_under_the_ceiling` (80 over a simulated 100 s at 0.05 s granularity), `test_reserve_lowers_the_ceiling` (60 with reserve 20) |
| (2) `Retry-After` of N honored; no dispatch before `now + N` | `test_backoff_deadline_equals_retry_after_when_jitter_is_smaller`, `test_no_dispatch_to_that_bucket_before_the_retry_after_deadline` (60 probes across the penalty), `test_retry_after_is_a_minimum_not_a_replacement` (50 seeds), `test_exhausted_primary_budget_waits_for_the_reset_deadline` |
| (3) 429 halves concurrency; recovery is slow-start then additive | `test_limit_event_halves_the_window`, `test_recovery_is_slow_start_then_additive` (exact sequence `[1,2,4,5,6,7,8]`), `test_window_does_not_grow_while_it_is_underused`, `test_scheduler_resumes_at_the_floor_not_the_prior_level` |
| (4) Draining bucket A never delays bucket B | `test_exhausted_bucket_does_not_stall_a_healthy_one`, `test_backoff_on_one_bucket_does_not_delay_another` (300 s penalty on `core`, `search` dispatches throughout), `test_the_shared_global_cap_is_the_one_coupling_between_buckets` |
| (5) Full jitter within `[0, cap]`, varies with seed | `test_stays_within_zero_and_the_attempt_bound` (2,200 draws over 11 attempts), `test_same_seed_reproduces_the_same_sequence`, `test_different_seeds_produce_different_delays`, `test_scheduler_backoff_deadlines_vary_with_the_seed` |
| Additional | window rollover, cold start, config validation |

Because a suite that passes on the first run proves nothing, each property was
**mutation-checked**: the implementation was broken in six ways in a scratch
copy, and every mutant was caught.

## Evidence

Test run, from `/Users/ankitsingh/Documents/enterprise-workflow-harness/.prototype/001-rate-limit-scheduler`:

```
$ python3 -m unittest discover -s spike -v
...
test_hard_ceiling_is_exactly_utilization_times_limit (test_scheduler.UtilizationCeilingTest...) ... ok
test_paced_dispatch_over_a_window_stays_under_the_ceiling (test_scheduler.UtilizationCeilingTest...) ... ok
test_reserve_lowers_the_ceiling (test_scheduler.UtilizationCeilingTest...) ... ok
test_allowance_resets_after_the_reset_deadline (test_scheduler.WindowRolloverTest...) ... ok

----------------------------------------------------------------------
Ran 22 tests in 0.006s

OK
```

Mutation check — each mutant SHOULD fail, and each did:

```
no_utilization_ceiling       Ran 21 tests in 0.006s  FAILED (failures=5)
retry_after_ignored          Ran 21 tests in 0.006s  FAILED (failures=3)
instant_jump_recovery        Ran 21 tests in 0.006s  FAILED (failures=2)
no_multiplicative_decrease   Ran 21 tests in 0.007s  FAILED (failures=4)
shared_bucket_state          Ran 21 tests in 0.006s  FAILED (failures=2)
jitter_not_random            Ran 21 tests in 0.006s  FAILED (failures=2)

=== unmutated baseline (SHOULD pass) ===
Ran 21 tests in 0.006s
OK
```

(Mutation checks ran against the 21-test suite, before the global-cap test was
added; they were run on throwaway copies under the session scratchpad, never on
the spike itself.)

The measurement that drives finding 1 — the chapter's own formula versus the
allowance formula, same 100-request budget over one full window:

```
paced dispatches in one 100s window (ceiling 80): 80
naive remaining*U/window formula spends: 99 of 100 budget (ceiling was 80)
```

Static checks:

```
$ uvx --offline ruff check --output-format=concise .
All checks passed!              # ruff 0.16.0; 3 findings fixed (UP035, SIM113, RUF007)
$ uvx --offline ruff format .
1 file reformatted, 1 file left unchanged
```

`mypy` is **not_run** — it is not in the local uv cache and installing it would
require a network call, which this prototype is forbidden to make. Type
annotations are present on every public parameter and return but are unverified
by a checker.

## Decision impact

### Supports

- One limiter per bucket, header-driven tracking, AIMD, full jitter, and
  `Retry-After` precedence all fit in **one stdlib module, 228 lines of code**
  (448 with docstrings), with **zero** timing flakiness.
- **Time as a parameter beats a clock seam.** Because `now` is an argument to
  every public method, the module needs no `Clock` protocol, no monkeypatching,
  and no sleeping. The `FakeClock` in the tests is a readability convenience for
  driver loops, not a dependency. D07 should mandate this shape.
- Full jitter, bucket isolation, and the AIMD cut are all exactly as the chapter
  describes and need no revision.

### Changes — D07's prompt should say these differently

1. **The utilization ceiling must be a per-window allowance, not a rate cap.**
   This is the significant finding. `adaptive-scheduling.md` says `budget =
   remaining * UTILIZATION - RESERVE; rate = budget / window`, recomputed per
   response. Because it re-derives from `remaining` every time, it is a decaying
   rate that asymptotes to zero but *integrates to the entire budget*: measured,
   it spends **99 of 100** requests over a full window while claiming an 80%
   ceiling. It never triggers a 429, so the bug is invisible in testing and
   shows up only as a drained co-tenant budget. The ceiling must be enforced as
   a count against the window's `limit` (`limit * utilization - reserve`),
   tracked via `used = limit - remaining`, with the rate derived from the
   *remaining allowance*. D07 must prescribe "at most `ceiling × limit`
   dispatches per window", not "pace at `ceiling × remaining / window`".

2. **`Retry-After` is a minimum, not an exact wait.** The spike brief says
   "honored exactly"; both providers say otherwise — Atlassian: "use the
   `Retry-After` header value as the minimum delay"; GitHub: "do not retry
   earlier". The correct rule is `sleep = max(retry_after, jittered_backoff)`.
   Prescribing "exactly N" would forbid the jitter that decorrelates a fleet of
   workers all released by the same deadline — the retry-storm shape the chapter
   warns about. Test 2 asserts exactness only where jitter is provably smaller,
   plus a `>= now + N` invariant across 50 seeds.

3. **"Halve, then slow-start to the pre-event ceiling" is self-contradictory.**
   If the window is cut to half and slow start doubles toward the *pre-event*
   level, it arrives there in one step — precisely the instant jump the
   requirement forbids. The chapter's own pseudocode has two moments, and D07
   needs all three numbers: the **cut factor** at the event (0.5), the
   **recovery floor** at resume (`min_concurrency`), and the halved value as the
   **slow-start ceiling** (TCP `ssthresh`). Implemented that way, 8 → 4 at the
   event → 1 at resume → `1,2,4` doubling → `5,6,7,8` additive: the prior level
   returns after 6 success epochs, never in one.

4. **Bucket isolation has exactly one documented exception.** GitHub's
   100-concurrent cap spans REST and GraphQL, so a global in-flight semaphore
   couples every bucket. The coupling is *only* on unanswered requests — spent
   budget never crosses buckets. D07 should state the exception rather than
   claim buckets never interact, and `HOLD` should name it (`global_concurrency`
   vs `concurrency`) so the distinction is visible in traces.

5. **AIMD growth needs the utilization gate.** Netflix's `AIMDLimit` increases
   only when `inflight * 2 >= limit`. Without it, "+1 per success epoch" grows
   the window during idle periods, so the first burst after a quiet stretch
   opens at a parallelism that was never validated against the provider.

6. **`decide()` cannot be a pure query.** A DISPATCH consumes a token and an
   in-flight slot, so it must mutate. Collapsing observation into it caused a
   real bug during the spike: feeding response events through `decide()` silently
   consumed budget for dispatches that never happened. Two methods (`observe`
   for feedback, `decide` for the gate) is the contract; D07 should also state
   that **every dispatch must be answered by exactly one event**, including
   timeouts, or in-flight slots leak permanently.

### Still unknown — what this spike does NOT prove

- **Real header parsing and reset normalization are untested.** `reset_at`
  arrives already normalized. GitHub epoch seconds, Datadog delta seconds, and
  Atlassian ISO 8601 all still have to be converted by an adapter, and the
  chapter flags mixing them as corrupting every downstream computation. That
  adapter deserves its own tests, possibly its own prototype.
- **Window *length* is not observable from headers.** Headers give the reset
  instant, never the duration, so the module cannot know a fresh window's size
  until it has seen two consecutive reset boundaries. The spike falls back to a
  configured `default_window` (3600 s for GitHub). A wrong default only affects
  rollover when no response arrives, but it is a real gap in the contract.
- **Single process only.** All state is in-memory. Two processes sharing a PAT
  each believe they own the full budget. `reserve` is a stopgap, not a fix;
  genuine multi-process coordination needs shared state and was not prototyped.
- **Not thread-safe.** No locks. Concurrent `decide()` calls would race on the
  token count and in-flight counters.
- **Requests, not points.** The spike counts requests. GitHub's secondary
  budgets are *points* per minute (900 REST, 2,000 GraphQL) with writes costing
  5× reads, and those minute-scale budgets are a second limiter dimension the
  spike does not model at all.
- **Not built:** retry budget (3 attempts, ≤10% of volume), adaptive client
  throttling (`requests > 2 × accepts`), circuit breaker, request coalescing,
  ETag caching. All are in the chapter; none are in this module.
- **No real provider traffic.** Every response is synthetic. Nothing here has
  met a real 429.
- **`mypy` not run** (see Evidence).

### Recommendation

**Accept, with the six revisions above folded into D07's prompt.** The core
question is answered affirmatively — the contract is implementable as one small
deterministic module, and every timing behavior is testable without a real clock
or real randomness. No further prototype is needed for the scheduler contract
itself.

One follow-up prototype is worth considering, and it is *not* the scheduler:
**header normalization across the three providers**, which this spike explicitly
assumed away and which the chapter identifies as corrupting all downstream math
if botched.

## Files

- `spike/scheduler.py` — the module (448 lines; 228 code, stdlib only).
- `spike/test_scheduler.py` — 22 deterministic tests.
- `README.md` — this record.
