# Exponential Backoff and Jitter (AWS Architecture Blog)

- Source URL: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch); the article's pseudocode is rendered as figures/images, so formula renderings were cross-checked with two independent fetches. Where the two fetches disagreed, both renderings are recorded.

## Problem setup

Optimistic concurrency control (OCC) under high contention: when N clients update the same database row simultaneously, only one succeeds per round, requiring N rounds; "the total amount of work done by the system increases with N²" because every client competes in each round.

## Exponential backoff (no jitter)

Clients sleep for: `min(cap, base * 2^attempt)`

Reduces contention slightly but creates clustering — "gaps" with no activity followed by spikes of synchronized retries.

## Jitter variants (formulas as rendered in fetches)

- **Full Jitter** (both fetches agree): `sleep = random(0, min(cap, base * 2^attempt))`
- **Equal Jitter** (fetch 1 rendering): `temp = min(cap, base * 2^attempt); sleep = temp/2 + random(0, temp/2)` (fetch 2 rendered it as `base + random(0, min(cap, base * 2^attempt))` — fetch 1's rendering matches the widely-cited form)
- **Decorrelated Jitter**: fetch 1: `sleep = min(cap, random(0, 3 * last_sleep))`; fetch 2: `sleep = min(cap, random(0, sleep * 3))`. The random lower bound is ambiguous in the extraction (commonly cited elsewhere as `base`, but that was NOT verified here).

## Performance conclusions (100 contending clients)

- Call volume: Full and Equal Jitter performed similarly; Decorrelated used slightly more calls; all "substantially reduce[] client work and server load".
- Completion time: Equal Jitter was "the loser", requiring "much longer" time. Full and Decorrelated Jitter were comparable.
- Overall winner: Full Jitter — lowest work with competitive completion times.

## Concluding recommendation (quoted)

"The return on implementation complexity of using jittered backoff is huge, and it should be considered a standard approach for remote clients."
