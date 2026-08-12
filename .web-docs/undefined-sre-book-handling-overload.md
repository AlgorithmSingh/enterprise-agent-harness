# Google SRE Book — Handling Overload (Chapter 21)

- Source URL: https://sre.google/sre-book/handling-overload/
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch). The exact rejection-probability formula is an image on the page and could not be extracted as text; the mechanism and constants below were extracted.

## Client-side adaptive throttling

Each client tracks two metrics over a two-minute window:

- **requests**: application-layer requests attempted by the client
- **accepts**: requests actually accepted by the backend

Mechanism (quoted): "Clients can continue to issue requests to the backend until `requests` is K times as large as `accepts`. Once that cutoff is reached, the client begins to self-regulate and new requests are rejected locally."

- Standard multiplier: **K = 2**.
- "Reducing the multiplier will make adaptive throttling behave more aggressively" (e.g., K = 1.1 allows roughly one rejection per ten accepted requests).
- (The rejection probability formula — max(0, (requests − K·accepts)/(requests + 1)) in the published book — is shown as an image on the page; that exact expression was not text-verified in this fetch.)

## Retry budgets

1. **Per-request budget**: "up to three attempts" maximum before the failure bubbles up to the caller.
2. **Per-client budget**: retries must stay "below 10%" of total requests.
3. Attempt counts are carried in request metadata (incrementing 0 through 2), letting backends detect widespread overload and respond with "don't retry"/overloaded errors instead of accepting more retries.

## Criticality levels

- **CRITICAL_PLUS**: most severe user-visible failures if dropped
- **CRITICAL**: default for production; user impact expected if dropped
- **SHEDDABLE_PLUS**: default for batch jobs; partial unavailability expected
- **SHEDDABLE**: frequent partial or occasional full unavailability acceptable
