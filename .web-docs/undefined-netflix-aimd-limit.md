# Netflix concurrency-limits AIMDLimit.java (master)

- Source URL: https://raw.githubusercontent.com/Netflix/concurrency-limits/master/concurrency-limits-core/src/main/java/com/netflix/concurrency/limits/limit/AIMDLimit.java
- Accessed: 2026-08-12
- Note: exact code lines extracted via WebFetch.

## Builder defaults (quoted)

- `private int minLimit = 20;`
- `private int initialLimit = 20;`
- `private int maxLimit = 200;`
- `private double backoffRatio = 0.9;`
- `private long timeout = DEFAULT_TIMEOUT;` where `private static final long DEFAULT_TIMEOUT = TimeUnit.SECONDS.toNanos(5);`

## Update logic (quoted)

Decrease (multiplicative) on dropped request or RTT above timeout:

```java
if (didDrop || rtt > timeout) { currentLimit = (int) (currentLimit * backoffRatio); }
```

Increase (additive, +1) when the limit is actually being used:

```java
else if (inflight * 2 >= currentLimit) { currentLimit = currentLimit + 1; }
```

Clamp:

```java
return Math.min(maxLimit, Math.max(minLimit, currentLimit));
```
