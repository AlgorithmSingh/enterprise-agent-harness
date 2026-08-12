# Google SRE Workbook — Chapter 11: Managing Load

- Source URL: https://sre.google/workbook/managing-load/
- Accessed: 2026-08-12
- Note: content extracted via WebFetch (summarizing fetch).

## Coverage

Traffic management via three interconnected systems:

1. **Load balancing** — Google Cloud Load Balancer (GCLB) architecture: Maglev, Global Software Load Balancer (GSLB), Google Front End (GFE), anycast routing.
2. **Autoscaling** — horizontal and vertical scaling; handling unhealthy machines, stateful systems, conservative configuration.
3. **Load shedding** — dropping excess traffic to prevent cascading failures.

## Case studies

- **Pokémon GO**: migration to GCLB under massive unexpected demand (50x initial projections); revealed interactions between retry storms, SSL performance, and load balancing.
- **Dressy**: load shedding and load balancing miscommunication concentrated traffic in one region while others stayed empty.

## What this chapter does NOT cover

Retry budgets, client-side throttling, and detailed overload-handling mechanics are not substantially covered here. Those live in the original SRE Book chapter "Handling Overload" (see sre.google/sre-book/handling-overload/); the workbook references a separate chapter ("Identifying and Recovering from Overload") for overload recovery.

## Key insight

Load balancing, load shedding, and autoscaling must be treated as an integrated whole, not independent tools.
