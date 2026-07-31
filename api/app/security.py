"""Lightweight API-key gate, per-IP rate limiting, and a shared spend ceiling.

Proportionate for a hackathon demo (not enterprise): the goal is to stop an
anonymous visitor from draining the watsonx budget during live judging by
hammering /agent/* (each request fires up to ~5 model calls) or /generate.

* ``require_api_key`` — a FastAPI dependency. If ``WRITERS_ROOM_API_KEY`` is
  unset, the endpoint is open (convenient for local dev). If set, requests
  must send ``X-API-Key: <value>``.
* ``RateLimiter`` — a per-IP sliding-window limiter, injected as a dependency
  via ``RateLimiter(...)``. In-memory; resets on restart, which is fine for a
  demo. For multi-process deploys you'd swap this for Redis, but that's
  post-deadline scope.
* ``DailyBudget`` — one process-wide ceiling on model calls per rolling day,
  shared by every spending route. The limiter caps a caller's *rate*; this caps
  the service's *total*, which is the number a token allowance is measured in.

The three are complements. A key stops strangers, the limiter stops one stranger
going fast, and the budget stops many strangers going slowly — or one honest
demo looping harder than anyone expected.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass
from secrets import compare_digest
from threading import Lock

from fastapi import Header, HTTPException, Request, status

from app.config import settings


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Dependency: enforce a shared API key if one is configured.

    No key configured -> open access (local dev). Key configured -> reject 401
    unless the header matches.
    """
    expected = settings.writers_room_api_key
    if not expected:
        return  # Open mode — no gate.
    if not compare_digest(x_api_key or "", expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-API-Key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )


class RateLimiter:
    """Sliding-window per-IP rate limiter as a FastAPI dependency factory.

    Usage::

        _rl = RateLimiter(max_calls=20, window_seconds=60)

        @router.post("/x", dependencies=[Depends(_rl)])
        async def x(...): ...

    Or as a default-arg Depends (as in agent.py). The client IP is read from
    the request, preferring ``X-Forwarded-For`` for proxied deploys.
    """

    def __init__(self, max_calls: int, window_seconds: int) -> None:
        self.max_calls = max_calls
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        # FastAPI may execute synchronous dependencies in its worker pool, so
        # protect the read/evict/check/append sequence as one operation.
        self._lock = Lock()

    def __call__(self, request: Request) -> None:
        client_ip = self._client_ip(request)
        now = time.monotonic()

        with self._lock:
            bucket = self._hits[client_ip]

            # Evict entries outside the window.
            while bucket and now - bucket[0] > self.window:
                bucket.popleft()

            if len(bucket) >= self.max_calls:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded: {self.max_calls} requests per {self.window}s.",
                    headers={"Retry-After": str(self.window)},
                )
            bucket.append(now)

    @staticmethod
    def _client_ip(request: Request) -> str:
        if settings.trust_proxy_headers:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"


@dataclass
class _Charge:
    """One request's charge against the budget.

    ``calls`` is mutable and drops to zero when the charge is refunded *or*
    ages out of the window — so a late refund on an already-expired charge
    cannot subtract the same calls twice.
    """

    at: float
    calls: int


@dataclass(frozen=True)
class Reservation:
    """What a budgeted route receives: a handle for giving back what it didn't spend."""

    _budget: DailyBudget
    _charge: _Charge

    def refund(self, calls: int) -> None:
        """Return ``calls`` to the shared budget, clamped to what was charged."""
        self._budget.refund(self._charge, calls)


class DailyBudget:
    """A process-wide ceiling on model calls over a rolling window.

    Each route declares its own worst-case cost and is charged that up front::

        _budget = daily_budget.cost(15)          # at import time, once

        @router.post("/x")
        async def x(budget: Annotated[Reservation, Depends(_budget)]): ...

    A route that later learns what it actually spent hands the difference back
    through the ``Reservation``. Charging the worst case first and refunding
    after is the safe direction to be wrong in: the ceiling is never overshot
    while a request is still in flight.

    Cost is counted in model calls rather than tokens because that is the number
    this code can know for certain without trusting a provider's accounting. It
    is a ceiling, not an accountant: in-memory and per-process, so a restart
    clears it and a multi-worker deploy gets one budget per worker.

    A route that spends nothing — ``/voice/check`` is pure arithmetic — is
    deliberately left unbudgeted rather than charged zero, so the dependency list
    itself says which endpoints cost money.
    """

    def __init__(self, max_calls: int, window_seconds: int = 86_400) -> None:
        self.max_calls = max_calls
        self.window = window_seconds
        self._charges: deque[_Charge] = deque()
        self._spent = 0
        self._lock = Lock()

    def cost(self, calls: int) -> Callable[[], Reservation]:
        """Build a FastAPI dependency that charges ``calls`` per request.

        Call this once at import time and reuse the result: FastAPI keys its
        per-request dependency cache on the callable, so a fresh closure per
        request would defeat it.
        """

        def _reserve() -> Reservation:
            return self.charge(calls)

        return _reserve

    def charge(self, calls: int) -> Reservation:
        """Reserve ``calls`` against the budget, or raise 429 if the day is spent."""
        if self.max_calls <= 0:
            # Disabled: hand back an inert reservation rather than tracking
            # charges nobody will ever check.
            return Reservation(self, _Charge(at=0.0, calls=0))

        now = time.monotonic()
        with self._lock:
            self._evict(now)
            if self._spent + calls > self.max_calls:
                retry_after = self._retry_after(now)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Daily model-call budget spent: {self._spent}/{self.max_calls} "
                        f"in the last {self.window // 3600}h. Capacity frees up in "
                        f"{retry_after}s."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )
            charge = _Charge(at=now, calls=calls)
            self._charges.append(charge)
            self._spent += calls
            return Reservation(self, charge)

    def refund(self, charge: _Charge, calls: int) -> None:
        """Give unspent calls back. Called through :class:`Reservation`."""
        if calls <= 0:
            return
        with self._lock:
            given_back = min(calls, charge.calls)
            charge.calls -= given_back
            self._spent -= given_back

    def snapshot(self) -> dict[str, int]:
        """Current spend, for ``/healthz`` — so the budget can be watched live."""
        with self._lock:
            self._evict(time.monotonic())
            return {
                "limit": self.max_calls,
                "spent": self._spent,
                "remaining": max(0, self.max_calls - self._spent),
            }

    def reset(self) -> None:
        """Forget every charge. For tests; nothing in the app calls this."""
        with self._lock:
            self._charges.clear()
            self._spent = 0

    # -- internals (call under ``self._lock``) ------------------------------- #

    def _evict(self, now: float) -> None:
        while self._charges and now - self._charges[0].at > self.window:
            expired = self._charges.popleft()
            self._spent -= expired.calls
            expired.calls = 0

    def _retry_after(self, now: float) -> int:
        """Seconds until the oldest charge ages out and frees capacity."""
        if not self._charges:
            return 1
        return max(1, int(self.window - (now - self._charges[0].at)) + 1)


# One budget for the whole process. Routes import this instance rather than
# building their own, because the point is a single shared ceiling.
daily_budget = DailyBudget(settings.writers_room_daily_model_calls)
