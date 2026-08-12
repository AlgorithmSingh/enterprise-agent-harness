"""Deterministic rate-limit scheduler spike.

Prototype-assisted design instrument for gate D07. NOT production code.

Scope: the scheduling decision only. Every timing input is a parameter, so the
module has no clock, no sleep, no I/O, and no randomness of its own:

  * wall time enters as the ``now`` argument of every public method;
  * randomness enters as an injected ``random_unit`` callable returning [0, 1);
  * budget facts enter as :class:`Event` values whose ``reset_at`` is already
    normalized to the caller's clock.

Header parsing and reset-semantics normalization (GitHub epoch seconds,
Datadog delta seconds, Atlassian ISO 8601) are deliberately OUT of scope: they
are a separate adapter contract, and folding them in here would hide the pacing
math behind string parsing.

Sources for the algorithms: docs/book/adaptive-scheduling.md (token bucket,
AIMD, full jitter, slow start, utilization ceiling) and
docs/book/github-rate-limits.md section 5.7 (ordered backoff protocol).
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum

Seconds = float
RandomUnit = Callable[[], float]

# The pacing window can never be treated as shorter than this, or the computed
# rate diverges as the reset deadline is approached.
_MIN_WINDOW: Seconds = 1.0

# Ceiling on the exponent used for backoff, so base * 2**attempt cannot overflow
# on a runaway attempt counter. The cap dominates long before this matters.
_MAX_BACKOFF_EXPONENT = 32


class EventKind(Enum):
    """What a completed request told us."""

    SUCCESS = "success"
    RATE_LIMITED = "rate_limited"
    TRANSIENT_ERROR = "transient_error"


class ActionKind(Enum):
    """What the scheduler permits right now."""

    DISPATCH = "dispatch"
    HOLD = "hold"
    BACKOFF = "backoff"


class GrowthMode(Enum):
    """How the concurrency window is currently re-growing."""

    SLOW_START = "slow_start"
    ADDITIVE = "additive"


@dataclass(frozen=True)
class Event:
    """A header-style observation of one completed request.

    ``reset_at`` is an absolute deadline on the caller's clock, already
    normalized from whichever provider representation the response carried.
    ``retry_after`` is a duration in seconds, as the header states it.
    """

    kind: EventKind
    limit: int | None = None
    remaining: int | None = None
    reset_at: Seconds | None = None
    retry_after: Seconds | None = None


@dataclass(frozen=True)
class Action:
    """A scheduling decision.

    ``not_before`` is when the caller may ask again; for DISPATCH it equals the
    ``now`` that produced it. HOLD means a budget, pacing, or concurrency
    constraint binds; BACKOFF means the bucket is serving a penalty from a
    rate-limit event.
    """

    kind: ActionKind
    not_before: Seconds
    reason: str


@dataclass(frozen=True)
class SchedulerConfig:
    """Tuning contract. Defaults follow the chapter's design heuristics."""

    utilization: float = 0.8
    reserve: int = 0
    burst: float = 1.0
    min_concurrency: int = 1
    max_concurrency: int = 100
    initial_concurrency: int = 8
    decrease_factor: float = 0.5
    backoff_base: Seconds = 1.0
    backoff_cap: Seconds = 60.0
    max_global_inflight: int = 100
    default_window: Seconds = 3600.0

    def __post_init__(self) -> None:
        if not 0.0 < self.utilization <= 1.0:
            raise ValueError("utilization must be in (0, 1]")
        if not 0.0 < self.decrease_factor < 1.0:
            raise ValueError("decrease_factor must be in (0, 1)")
        if self.min_concurrency < 1:
            raise ValueError("min_concurrency must be >= 1")
        if self.max_concurrency < self.min_concurrency:
            raise ValueError("max_concurrency must be >= min_concurrency")


def full_jitter(
    attempt: int,
    base: Seconds,
    cap: Seconds,
    random_unit: RandomUnit,
) -> Seconds:
    """AWS full jitter: ``random(0, min(cap, base * 2**attempt))``."""
    bound = min(cap, base * 2.0 ** min(attempt, _MAX_BACKOFF_EXPONENT))
    return random_unit() * bound


class BucketState:
    """Budget window for one bucket, driven by header-style observations.

    Tracks consumption as ``used_from_headers + in_flight``: every dispatched
    request is either already reflected in the newest observation or still in
    flight, so the sum never double-counts and never lags by more than the
    requests whose responses have not arrived.
    """

    def __init__(self, config: SchedulerConfig) -> None:
        self._config = config
        self._limit: int | None = None
        self._reset_at: Seconds | None = None
        self._window: Seconds = config.default_window
        self._used: int = 0
        self._tokens: float = config.burst
        self._token_time: Seconds | None = None

    @property
    def limit(self) -> int | None:
        """Budget size last reported by a header observation, if any."""
        return self._limit

    @property
    def reset_at(self) -> Seconds | None:
        return self._reset_at

    def observe(self, now: Seconds, event: Event) -> None:
        """Fold a header observation into the window.

        Headers report when the window resets but never how long it is, so the
        window length stays at the configured provider default until two
        distinct reset boundaries have been seen; their difference is the true
        window length.
        """
        if event.limit is None or event.remaining is None:
            return
        if event.reset_at is not None:
            if self._reset_at is not None and event.reset_at > self._reset_at:
                self._window = event.reset_at - self._reset_at
            self._reset_at = event.reset_at
        self._limit = event.limit
        self._used = max(0, event.limit - event.remaining)

    def roll_if_expired(self, now: Seconds) -> None:
        """Start a fresh window once the reset deadline has passed.

        Providers use fixed windows, so consumption resets even without a new
        response to tell us so.
        """
        if self._reset_at is None or now < self._reset_at:
            return
        elapsed = now - self._reset_at
        windows = math.floor(elapsed / self._window) + 1
        self._reset_at += windows * self._window
        self._used = 0

    def allowance(self) -> float:
        """Hard per-window dispatch ceiling: ``limit * utilization - reserve``."""
        if self._limit is None:
            return math.inf
        return max(0.0, self._limit * self._config.utilization - self._config.reserve)

    def remaining_allowance(self, in_flight: int) -> float:
        """Dispatches still permitted in this window."""
        allowance = self.allowance()
        if allowance == math.inf:
            return math.inf
        return allowance - (self._used + in_flight)

    def pacing_rate(self, now: Seconds, in_flight: int) -> float:
        """Dispatches per second that spend the remaining allowance evenly."""
        remaining = self.remaining_allowance(in_flight)
        if remaining == math.inf:
            return math.inf
        window_left = _MIN_WINDOW
        if self._reset_at is not None:
            window_left = max(self._reset_at - now, _MIN_WINDOW)
        return max(0.0, remaining) / window_left

    def refill(self, now: Seconds, in_flight: int) -> None:
        """Accrue tokens for elapsed time at the current pacing rate."""
        if self._token_time is None:
            self._token_time = now
            return
        rate = self.pacing_rate(now, in_flight)
        elapsed = max(0.0, now - self._token_time)
        self._token_time = now
        if rate == math.inf:
            self._tokens = self._config.burst
            return
        self._tokens = min(self._config.burst, self._tokens + elapsed * rate)

    @property
    def tokens(self) -> float:
        return self._tokens

    def time_to_token(self, now: Seconds, in_flight: int) -> Seconds:
        """Seconds until one whole token exists at the current rate."""
        rate = self.pacing_rate(now, in_flight)
        if rate <= 0.0:
            return _MIN_WINDOW
        if rate == math.inf:
            return 0.0
        return (1.0 - self._tokens) / rate

    def consume_token(self) -> None:
        self._tokens -= 1.0


class AimdConcurrency:
    """AIMD window with TCP-shaped recovery.

    On a limit event the window is cut multiplicatively and that halved value
    becomes the slow-start ceiling. On resume the window restarts at the floor
    and doubles back up to that ceiling, then grows additively — so the prior
    level is never restored in a single step.
    """

    def __init__(self, config: SchedulerConfig) -> None:
        self._config = config
        self._limit = max(
            config.min_concurrency,
            min(config.initial_concurrency, config.max_concurrency),
        )
        self._mode = GrowthMode.ADDITIVE
        self._slow_start_ceiling = self._limit

    @property
    def limit(self) -> int:
        return self._limit

    @property
    def mode(self) -> GrowthMode:
        return self._mode

    @property
    def slow_start_ceiling(self) -> int:
        return self._slow_start_ceiling

    def on_limit_event(self) -> None:
        """Multiplicative decrease; remember the halved level as the ceiling."""
        halved = max(
            self._config.min_concurrency,
            math.floor(self._limit * self._config.decrease_factor),
        )
        self._slow_start_ceiling = halved
        self._limit = halved

    def on_resume(self) -> None:
        """Restart at the floor in slow start once the penalty has elapsed."""
        self._limit = self._config.min_concurrency
        self._mode = GrowthMode.SLOW_START

    def on_success(self, in_flight_at_response: int) -> None:
        """Grow, but only when the current window is actually being used."""
        if in_flight_at_response * 2 < self._limit:
            return
        if self._mode is GrowthMode.SLOW_START:
            self._limit = min(self._limit * 2, self._slow_start_ceiling)
            if self._limit >= self._slow_start_ceiling:
                self._mode = GrowthMode.ADDITIVE
        else:
            self._limit = min(self._limit + 1, self._config.max_concurrency)


class _BucketRuntime:
    """Per-bucket scheduling state: budget window, AIMD window, penalty."""

    def __init__(self, config: SchedulerConfig) -> None:
        self.state = BucketState(config)
        self.aimd = AimdConcurrency(config)
        self.in_flight = 0
        self.backoff_until: Seconds | None = None
        self.pending_resume = False
        self.consecutive_limit_events = 0


class RateLimitScheduler:
    """One limiter per budget bucket, sharing only the global concurrency cap.

    Buckets are created lazily on first reference and never interact, except
    through ``max_global_inflight`` — which is shared by design, because
    GitHub's 100-concurrent-request cap spans REST and GraphQL together.
    """

    def __init__(self, config: SchedulerConfig, random_unit: RandomUnit) -> None:
        self._config = config
        self._random_unit = random_unit
        self._buckets: dict[str, _BucketRuntime] = {}
        self._global_in_flight = 0

    def _runtime(self, bucket: str) -> _BucketRuntime:
        runtime = self._buckets.get(bucket)
        if runtime is None:
            runtime = _BucketRuntime(self._config)
            self._buckets[bucket] = runtime
        return runtime

    def concurrency_limit(self, bucket: str) -> int:
        """Current AIMD window for a bucket (observability and tests)."""
        return self._runtime(bucket).aimd.limit

    def in_flight(self, bucket: str) -> int:
        return self._runtime(bucket).in_flight

    def growth_mode(self, bucket: str) -> GrowthMode:
        return self._runtime(bucket).aimd.mode

    def observe(self, now: Seconds, bucket: str, event: Event) -> None:
        """Record a completed request. Every event releases one in-flight slot."""
        runtime = self._runtime(bucket)
        matched_dispatch = runtime.in_flight > 0
        if matched_dispatch:
            runtime.in_flight -= 1
            self._global_in_flight -= 1
        # An event with no in-flight request to match (a priming observation)
        # must not count as window utilization, or it would grow the window
        # on traffic that never happened.
        in_flight_at_response = runtime.in_flight + 1 if matched_dispatch else 0

        runtime.state.observe(now, event)

        if event.kind is EventKind.RATE_LIMITED:
            self._apply_limit_event(now, runtime, event)
        elif event.kind is EventKind.SUCCESS:
            runtime.consecutive_limit_events = 0
            runtime.aimd.on_success(in_flight_at_response)

    def _apply_limit_event(
        self,
        now: Seconds,
        runtime: _BucketRuntime,
        event: Event,
    ) -> None:
        """Ordered backoff protocol: Retry-After, then reset, then jitter.

        ``Retry-After`` is a MINIMUM, not an exact wait: the computed jitter is
        used when it is longer, per Atlassian's explicit rule and GitHub's
        "do not retry earlier" phrasing.
        """
        wait = full_jitter(
            runtime.consecutive_limit_events,
            self._config.backoff_base,
            self._config.backoff_cap,
            self._random_unit,
        )
        if event.retry_after is not None:
            wait = max(wait, event.retry_after)
        elif event.remaining == 0 and event.reset_at is not None:
            wait = max(wait, event.reset_at - now)

        deadline = now + wait
        if runtime.backoff_until is None or deadline > runtime.backoff_until:
            runtime.backoff_until = deadline
        runtime.pending_resume = True
        runtime.consecutive_limit_events += 1
        runtime.aimd.on_limit_event()

    def decide(
        self,
        now: Seconds,
        bucket: str,
        event: Event | None = None,
    ) -> Action:
        """Decide what may happen for ``bucket`` at ``now``.

        A DISPATCH result consumes a pacing token and an in-flight slot; the
        caller must eventually report the outcome via :meth:`observe` or the
        slot leaks. HOLD and BACKOFF consume nothing.
        """
        if event is not None:
            self.observe(now, bucket, event)

        runtime = self._runtime(bucket)
        runtime.state.roll_if_expired(now)

        if runtime.backoff_until is not None and now < runtime.backoff_until:
            return Action(ActionKind.BACKOFF, runtime.backoff_until, "backoff")

        if runtime.pending_resume:
            runtime.pending_resume = False
            runtime.backoff_until = None
            runtime.aimd.on_resume()

        if runtime.in_flight >= runtime.aimd.limit:
            return Action(ActionKind.HOLD, now, "concurrency")

        if self._global_in_flight >= self._config.max_global_inflight:
            return Action(ActionKind.HOLD, now, "global_concurrency")

        if runtime.state.limit is None:
            # Cold start: no headers seen yet, so the budget is unknown. Probe
            # with a single request rather than guessing a rate.
            if runtime.in_flight >= 1:
                return Action(ActionKind.HOLD, now, "cold_start_probe")
            return self._dispatch(now, runtime)

        if runtime.state.remaining_allowance(runtime.in_flight) < 1.0:
            reset_at = runtime.state.reset_at
            deadline = now + _MIN_WINDOW if reset_at is None else reset_at
            return Action(ActionKind.HOLD, deadline, "budget_exhausted")

        runtime.state.refill(now, runtime.in_flight)
        if runtime.state.tokens < 1.0:
            wait = runtime.state.time_to_token(now, runtime.in_flight)
            return Action(ActionKind.HOLD, now + wait, "pacing")

        runtime.state.consume_token()
        return self._dispatch(now, runtime)

    def _dispatch(self, now: Seconds, runtime: _BucketRuntime) -> Action:
        runtime.in_flight += 1
        self._global_in_flight += 1
        return Action(ActionKind.DISPATCH, now, "dispatch")
