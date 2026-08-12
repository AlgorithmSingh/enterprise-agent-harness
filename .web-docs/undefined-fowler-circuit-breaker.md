# Martin Fowler — CircuitBreaker (bliki)

- Source URL: https://martinfowler.com/bliki/CircuitBreaker.html
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch).

## States

1. **Closed** — normal operation; calls proceed to the protected function. Failure counter tracks failures; "successful calls reset it back to zero."
2. **Open** — after failures exceed the threshold ("Once the failures reach a certain threshold, the circuit breaker trips"), calls return errors immediately without executing the underlying operation.
3. **Half-Open** — after the reset timeout elapses in the open state, a trial call tests recovery: success closes the breaker (counter reset); failure re-opens it and restarts the timeout.

## Parameters (example values from the article's sample code)

- Failure threshold: 5
- Reset timeout: 0.1 seconds (example value in sample code, not a production recommendation)

## Guidance (quoted)

- The breaker "avoids making the protected call when the circuit is open" and helps "reduce resources tied up in operations which are likely to fail."
- "Any change in breaker state should be logged"; "Breaker behavior is often a good source of warnings about deeper troubles."
- "clients using them need to react to breaker failures" — i.e., implement fallback/degradation strategies.
