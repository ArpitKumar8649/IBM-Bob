"""Lightweight API-key gate + in-memory per-IP rate limiting.

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
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
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
