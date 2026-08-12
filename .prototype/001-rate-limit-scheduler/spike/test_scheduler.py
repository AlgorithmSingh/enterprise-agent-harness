"""Deterministic tests for the rate-limit scheduler spike.

No real clock, no real randomness, no network, no filesystem. Time is an
explicit parameter of every scheduler call, so :class:`FakeClock` exists only to
make the driver loops read like a simulation; randomness is a seeded
``random.Random.random`` bound method injected at construction.
"""

from __future__ import annotations

import unittest
from itertools import pairwise
from random import Random

from scheduler import (
    Action,
    ActionKind,
    AimdConcurrency,
    Event,
    EventKind,
    GrowthMode,
    RateLimitScheduler,
    SchedulerConfig,
    full_jitter,
)


class FakeClock:
    """Monotonic clock the test advances by hand."""

    def __init__(self, start: float) -> None:
        self._now = start

    def now(self) -> float:
        return self._now

    def advance(self, seconds: float) -> float:
        self._now += seconds
        return self._now


def healthy(limit: int, remaining: int, reset_at: float) -> Event:
    return Event(
        kind=EventKind.SUCCESS,
        limit=limit,
        remaining=remaining,
        reset_at=reset_at,
    )


def drain_bucket(
    scheduler: RateLimitScheduler,
    now: float,
    bucket: str,
    limit: int,
    reset_at: float,
    max_iterations: int = 10_000,
) -> tuple[int, Action]:
    """Dispatch as fast as the scheduler allows at a single instant.

    Every dispatch is immediately answered with a success carrying decremented
    header budget, so only the utilization ceiling can stop the loop.
    """
    remaining = limit
    for dispatched in range(max_iterations):
        action = scheduler.decide(now, bucket)
        if action.kind is not ActionKind.DISPATCH:
            return dispatched, action
        remaining -= 1
        scheduler.observe(now, bucket, healthy(limit, remaining, reset_at))
    raise AssertionError("drain did not terminate")


class UtilizationCeilingTest(unittest.TestCase):
    """(1) Dispatch count never exceeds ceiling * budget within a window."""

    def test_hard_ceiling_is_exactly_utilization_times_limit(self) -> None:
        config = SchedulerConfig(utilization=0.8, burst=1000.0)
        scheduler = RateLimitScheduler(config, Random(1).random)
        clock = FakeClock(1000.0)
        reset_at = clock.now() + 100.0
        scheduler.observe(clock.now(), "core", healthy(100, 100, reset_at))

        dispatched, action = drain_bucket(scheduler, clock.now(), "core", 100, reset_at)

        self.assertEqual(dispatched, 80)
        self.assertIs(action.kind, ActionKind.HOLD)
        self.assertEqual(action.reason, "budget_exhausted")
        self.assertAlmostEqual(action.not_before, reset_at)

    def test_paced_dispatch_over_a_window_stays_under_the_ceiling(self) -> None:
        config = SchedulerConfig(utilization=0.8, burst=1.0)
        scheduler = RateLimitScheduler(config, Random(2).random)
        clock = FakeClock(1000.0)
        start = clock.now()
        reset_at = start + 100.0
        scheduler.observe(start, "core", healthy(100, 100, reset_at))

        remaining = 100
        dispatched = 0
        while clock.now() < reset_at:
            now = clock.now()
            if scheduler.decide(now, "core").kind is ActionKind.DISPATCH:
                dispatched += 1
                remaining -= 1
                scheduler.observe(now, "core", healthy(100, remaining, reset_at))
            clock.advance(0.05)

        self.assertLessEqual(dispatched, 80)
        # The pacer must also not be uselessly conservative, or the ceiling
        # assertion above would pass vacuously.
        self.assertGreaterEqual(dispatched, 70)

    def test_reserve_lowers_the_ceiling(self) -> None:
        config = SchedulerConfig(utilization=0.8, reserve=20, burst=1000.0)
        scheduler = RateLimitScheduler(config, Random(3).random)
        reset_at = 1100.0
        scheduler.observe(1000.0, "core", healthy(100, 100, reset_at))

        dispatched, _ = drain_bucket(scheduler, 1000.0, "core", 100, reset_at)

        self.assertEqual(dispatched, 60)


class RetryAfterPrecedenceTest(unittest.TestCase):
    """(2) Retry-After of N seconds is honored: no dispatch before now + N."""

    def _limited(self, retry_after: float) -> Event:
        return Event(
            kind=EventKind.RATE_LIMITED,
            limit=5000,
            remaining=4000,
            reset_at=4600.0,
            retry_after=retry_after,
        )

    def test_backoff_deadline_equals_retry_after_when_jitter_is_smaller(self) -> None:
        config = SchedulerConfig(backoff_base=1.0, backoff_cap=60.0, burst=10.0)
        scheduler = RateLimitScheduler(config, Random(4).random)
        now = 1000.0
        scheduler.observe(now, "core", healthy(5000, 5000, 4600.0))
        self.assertIs(scheduler.decide(now, "core").kind, ActionKind.DISPATCH)

        action = scheduler.decide(now, "core", self._limited(30.0))

        self.assertIs(action.kind, ActionKind.BACKOFF)
        self.assertAlmostEqual(action.not_before, 1030.0)

    def test_no_dispatch_to_that_bucket_before_the_retry_after_deadline(self) -> None:
        config = SchedulerConfig(backoff_base=1.0, backoff_cap=60.0, burst=10.0)
        scheduler = RateLimitScheduler(config, Random(5).random)
        clock = FakeClock(1000.0)
        scheduler.observe(clock.now(), "core", healthy(5000, 5000, 4600.0))
        scheduler.decide(clock.now(), "core")
        scheduler.observe(clock.now(), "core", self._limited(30.0))

        for _ in range(60):
            action = scheduler.decide(clock.now(), "core")
            self.assertIs(action.kind, ActionKind.BACKOFF)
            self.assertAlmostEqual(action.not_before, 1030.0)
            clock.advance(0.5)

        self.assertAlmostEqual(clock.now(), 1030.0)
        self.assertIs(scheduler.decide(clock.now(), "core").kind, ActionKind.DISPATCH)

    def test_retry_after_is_a_minimum_not_a_replacement(self) -> None:
        """A jittered backoff longer than Retry-After must win."""
        config = SchedulerConfig(backoff_base=1000.0, backoff_cap=60.0, burst=10.0)
        deadlines: set[float] = set()
        for seed in range(50):
            scheduler = RateLimitScheduler(config, Random(seed).random)
            scheduler.observe(1000.0, "core", healthy(5000, 5000, 4600.0))
            scheduler.decide(1000.0, "core")
            action = scheduler.decide(1000.0, "core", self._limited(5.0))
            self.assertGreaterEqual(action.not_before, 1005.0)
            deadlines.add(action.not_before)

        self.assertGreater(max(deadlines), 1005.0)

    def test_exhausted_primary_budget_waits_for_the_reset_deadline(self) -> None:
        config = SchedulerConfig(backoff_base=1.0, backoff_cap=60.0, burst=10.0)
        scheduler = RateLimitScheduler(config, Random(6).random)
        scheduler.observe(1000.0, "core", healthy(5000, 5000, 4600.0))
        scheduler.decide(1000.0, "core")

        exhausted = Event(
            kind=EventKind.RATE_LIMITED,
            limit=5000,
            remaining=0,
            reset_at=1600.0,
        )
        action = scheduler.decide(1000.0, "core", exhausted)

        self.assertIs(action.kind, ActionKind.BACKOFF)
        self.assertAlmostEqual(action.not_before, 1600.0)


class AimdRecoveryTest(unittest.TestCase):
    """(3) Halve on a limit event, then slow-start, then additive growth."""

    def test_limit_event_halves_the_window(self) -> None:
        config = SchedulerConfig(initial_concurrency=8, min_concurrency=1)
        aimd = AimdConcurrency(config)
        self.assertEqual(aimd.limit, 8)

        aimd.on_limit_event()

        self.assertEqual(aimd.limit, 4)
        self.assertEqual(aimd.slow_start_ceiling, 4)

    def test_recovery_is_slow_start_then_additive(self) -> None:
        config = SchedulerConfig(
            initial_concurrency=8, min_concurrency=1, max_concurrency=100
        )
        aimd = AimdConcurrency(config)
        aimd.on_limit_event()
        aimd.on_resume()

        observed = [aimd.limit]
        for _ in range(6):
            aimd.on_success(in_flight_at_response=aimd.limit)
            observed.append(aimd.limit)

        self.assertEqual(observed, [1, 2, 4, 5, 6, 7, 8])
        # Doubling while below the ceiling, +1 after it: never a step-function
        # back to the pre-event level.
        for previous, current in pairwise(observed):
            self.assertLessEqual(current, max(previous * 2, previous + 1))
        self.assertEqual(observed.index(8), 6)
        self.assertIs(aimd.mode, GrowthMode.ADDITIVE)

    def test_window_does_not_grow_while_it_is_underused(self) -> None:
        config = SchedulerConfig(initial_concurrency=8, min_concurrency=1)
        aimd = AimdConcurrency(config)

        aimd.on_success(in_flight_at_response=1)

        self.assertEqual(aimd.limit, 8)

    def test_scheduler_resumes_at_the_floor_not_the_prior_level(self) -> None:
        config = SchedulerConfig(
            initial_concurrency=8, min_concurrency=1, burst=10.0, backoff_base=1.0
        )
        scheduler = RateLimitScheduler(config, Random(7).random)
        scheduler.observe(1000.0, "core", healthy(5000, 5000, 4600.0))
        scheduler.decide(1000.0, "core")
        self.assertEqual(scheduler.concurrency_limit("core"), 8)

        limited = Event(
            kind=EventKind.RATE_LIMITED,
            limit=5000,
            remaining=4000,
            reset_at=4600.0,
            retry_after=30.0,
        )
        scheduler.observe(1000.0, "core", limited)
        self.assertEqual(scheduler.concurrency_limit("core"), 4)

        resumed = scheduler.decide(1030.0, "core")

        self.assertIs(resumed.kind, ActionKind.DISPATCH)
        self.assertEqual(scheduler.concurrency_limit("core"), 1)
        self.assertIs(scheduler.growth_mode("core"), GrowthMode.SLOW_START)
        self.assertEqual(scheduler.decide(1030.0, "core").reason, "concurrency")

        scheduler.observe(1030.0, "core", healthy(5000, 3999, 4600.0))

        self.assertEqual(scheduler.concurrency_limit("core"), 2)


class BucketIsolationTest(unittest.TestCase):
    """(4) Draining bucket A never delays dispatch for bucket B."""

    def test_exhausted_bucket_does_not_stall_a_healthy_one(self) -> None:
        config = SchedulerConfig(burst=1000.0)
        scheduler = RateLimitScheduler(config, Random(8).random)
        now = 1000.0
        scheduler.observe(now, "core", healthy(100, 100, now + 100.0))
        scheduler.observe(now, "search", healthy(30, 30, now + 60.0))

        dispatched, core_action = drain_bucket(scheduler, now, "core", 100, now + 100.0)
        self.assertEqual(dispatched, 80)
        self.assertEqual(core_action.reason, "budget_exhausted")

        search_action = scheduler.decide(now, "search")

        self.assertIs(search_action.kind, ActionKind.DISPATCH)
        self.assertAlmostEqual(search_action.not_before, now)

    def test_backoff_on_one_bucket_does_not_delay_another(self) -> None:
        config = SchedulerConfig(burst=10.0, initial_concurrency=8)
        scheduler = RateLimitScheduler(config, Random(9).random)
        now = 1000.0
        scheduler.observe(now, "core", healthy(5000, 5000, now + 3600.0))
        scheduler.observe(now, "search", healthy(30, 30, now + 60.0))
        scheduler.decide(now, "core")

        limited = Event(
            kind=EventKind.RATE_LIMITED,
            limit=5000,
            remaining=4000,
            reset_at=now + 3600.0,
            retry_after=300.0,
        )
        core_action = scheduler.decide(now, "core", limited)
        self.assertIs(core_action.kind, ActionKind.BACKOFF)

        for offset in (0.0, 1.0, 60.0, 299.0):
            search_action = scheduler.decide(now + offset, "search")
            self.assertIs(search_action.kind, ActionKind.DISPATCH)
            scheduler.observe(now + offset, "search", healthy(30, 29, now + 60.0))

        self.assertEqual(scheduler.concurrency_limit("core"), 4)
        self.assertEqual(scheduler.concurrency_limit("search"), 8)

    def test_the_shared_global_cap_is_the_one_coupling_between_buckets(self) -> None:
        """Isolation is not total: GitHub's 100-concurrent cap spans buckets.

        In-flight requests on one bucket can stall another. Only unanswered
        requests couple the buckets — spent budget does not.
        """
        config = SchedulerConfig(
            burst=10.0, initial_concurrency=8, max_global_inflight=3
        )
        scheduler = RateLimitScheduler(config, Random(13).random)
        now = 1000.0
        scheduler.observe(now, "core", healthy(5000, 5000, now + 3600.0))
        scheduler.observe(now, "search", healthy(30, 30, now + 60.0))

        for _ in range(3):
            self.assertIs(scheduler.decide(now, "core").kind, ActionKind.DISPATCH)

        blocked = scheduler.decide(now, "search")
        self.assertIs(blocked.kind, ActionKind.HOLD)
        self.assertEqual(blocked.reason, "global_concurrency")

        scheduler.observe(now, "core", healthy(5000, 4997, now + 3600.0))

        self.assertIs(scheduler.decide(now, "search").kind, ActionKind.DISPATCH)


class FullJitterTest(unittest.TestCase):
    """(5) Backoff stays within [0, cap] and varies with the seed."""

    def test_stays_within_zero_and_the_attempt_bound(self) -> None:
        base, cap = 1.0, 60.0
        rng = Random(10)
        for attempt in range(11):
            bound = min(cap, base * 2**attempt)
            for _ in range(200):
                delay = full_jitter(attempt, base, cap, rng.random)
                self.assertGreaterEqual(delay, 0.0)
                self.assertLessEqual(delay, bound)
                self.assertLessEqual(delay, cap)

    def test_same_seed_reproduces_the_same_sequence(self) -> None:
        first = [full_jitter(i, 1.0, 60.0, Random(42).random) for i in range(5)]
        second = [full_jitter(i, 1.0, 60.0, Random(42).random) for i in range(5)]

        self.assertEqual(first, second)

    def test_different_seeds_produce_different_delays(self) -> None:
        rng_a, rng_b = Random(1), Random(2)
        series_a = [full_jitter(i, 1.0, 60.0, rng_a.random) for i in range(8)]
        series_b = [full_jitter(i, 1.0, 60.0, rng_b.random) for i in range(8)]

        self.assertNotEqual(series_a, series_b)

    def test_scheduler_backoff_deadlines_vary_with_the_seed(self) -> None:
        config = SchedulerConfig(backoff_base=1.0, backoff_cap=60.0, burst=10.0)
        secondary = Event(
            kind=EventKind.RATE_LIMITED, limit=5000, remaining=4000, reset_at=4600.0
        )
        deadlines: set[float] = set()
        for seed in range(20):
            scheduler = RateLimitScheduler(config, Random(seed).random)
            scheduler.observe(1000.0, "core", healthy(5000, 5000, 4600.0))
            scheduler.decide(1000.0, "core")
            action = scheduler.decide(1000.0, "core", secondary)
            self.assertGreaterEqual(action.not_before, 1000.0)
            self.assertLessEqual(action.not_before, 1001.0)
            deadlines.add(action.not_before)

        self.assertGreater(len(deadlines), 1)


class WindowRolloverTest(unittest.TestCase):
    """A fixed window refills on its own once the reset deadline passes."""

    def test_allowance_resets_after_the_reset_deadline(self) -> None:
        config = SchedulerConfig(burst=1000.0, default_window=100.0)
        scheduler = RateLimitScheduler(config, Random(11).random)
        reset_at = 1100.0
        scheduler.observe(1000.0, "core", healthy(100, 100, reset_at))

        first, action = drain_bucket(scheduler, 1000.0, "core", 100, reset_at)
        self.assertEqual(first, 80)
        self.assertEqual(action.reason, "budget_exhausted")

        second, next_action = drain_bucket(scheduler, reset_at, "core", 100, 1200.0)

        self.assertEqual(second, 80)
        self.assertEqual(next_action.reason, "budget_exhausted")


class ColdStartTest(unittest.TestCase):
    """Before any header is seen the budget is unknown, so probe serially."""

    def test_unknown_budget_allows_one_probe_at_a_time(self) -> None:
        scheduler = RateLimitScheduler(SchedulerConfig(), Random(12).random)

        first = scheduler.decide(1000.0, "core")
        second = scheduler.decide(1000.0, "core")

        self.assertIs(first.kind, ActionKind.DISPATCH)
        self.assertIs(second.kind, ActionKind.HOLD)
        self.assertEqual(second.reason, "cold_start_probe")

        scheduler.observe(1000.0, "core", healthy(5000, 4999, 4600.0))

        self.assertIs(scheduler.decide(1000.0, "core").kind, ActionKind.DISPATCH)


class ConfigValidationTest(unittest.TestCase):
    def test_rejects_a_utilization_ceiling_outside_zero_to_one(self) -> None:
        with self.assertRaises(ValueError):
            SchedulerConfig(utilization=1.5)

    def test_rejects_a_non_contracting_decrease_factor(self) -> None:
        with self.assertRaises(ValueError):
            SchedulerConfig(decrease_factor=1.0)


if __name__ == "__main__":
    unittest.main()
