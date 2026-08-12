# Netflix concurrency-limits (README)

- Source URLs: https://github.com/Netflix/concurrency-limits and https://raw.githubusercontent.com/Netflix/concurrency-limits/master/README.md
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch). Java library applying TCP congestion control concepts to auto-detect service concurrency limits.

## Core principle

Little's Law: `Limit = Average RPS * Average Latency`. Manage concurrent requests (a "congestion window") rather than fixed RPS, preventing queue buildup before hard resource limits are reached. Limits are measured/estimated at each network point so nodes adjust locally.

## Limit algorithms

- **Vegas** (delay-based): estimates bottleneck queue as `L * (1 - minRTT/sampleRtt)`. Limit +1 per sampling window if estimated queue < alpha (2-3 requests); limit -1 if queue > beta (4-6 requests).
- **Gradient2**: tracks divergence between two exponential averages over short and long time windows; divergence duration detects queueing trends, smooths outliers in bursty traffic, and aggressively reduces the limit when divergence indicates queueing.

## Enforcement strategies

- **Simple**: single gauge of inflight requests; rejects when limit reached.
- **Percentage**: allocates concurrency limit percentages by request type (e.g., 90% live traffic, 10% batch).

## Integration examples (quoted from README)

GRPC server, Gradient2 with partitioning:

```java
ConcurrencyLimitServerInterceptor.newBuilder(
    new GrpcServerLimiterBuilder()
        .partitionByHeader(GROUP_HEADER)
        .partition("live", 0.9)
        .partition("batch", 0.1)
        .limit(WindowedLimit.newBuilder()
                .build(Gradient2Limit.newBuilder().build()))
```

GRPC client, Vegas, blocking:

```java
builder.intercept(new ConcurrencyLimitClientInterceptor(
    new GrpcClientLimiterBuilder()
        .blockOnLimit(true)
        .build()
))
```

- Servlet filter `ConcurrencyLimitServletFilter` rejects excess traffic with HTTP 429.
- `BlockingAdaptiveExecutor` adapts thread pool size based on measured Runnable latencies.
