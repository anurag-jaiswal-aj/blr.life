import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.errors import generic_exception_handler
from app.core.logging import request_id_ctx_var


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = str(uuid.uuid4())
        token = request_id_ctx_var.set(request_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            request_id_ctx_var.reset(token)


class ExceptionCatcherMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            # We catch exceptions here so that the response can bubble up through
            # the rest of the custom middlewares (CORS, RequestID, SecurityHeaders)
            return await generic_exception_handler(request, exc)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Omit Strict-Transport-Security until TLS is deployed
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: Any) -> None:
        super().__init__(app)
        self.rate_limit_per_minute = settings.RATE_LIMIT_PER_MINUTE
        self._history: dict[str, list[float]] = {}
        self._last_cleanup = time.monotonic()

    def _cleanup(self, now: float) -> None:
        """Periodic cleanup to prevent unbounded memory growth."""
        if now - self._last_cleanup > 60:
            for ip in list(self._history.keys()):
                valid_times = [t for t in self._history[ip] if now - t <= 60.0]
                if not valid_times:
                    del self._history[ip]
                else:
                    self._history[ip] = valid_times
            self._last_cleanup = now

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # We specifically target only computationally expensive endpoints
        if request.method == "POST" and request.url.path.endswith("/api/v1/recommend"):
            # Note: The direct peer IP is used. If deployed behind a reverse proxy
            # (e.g. Nginx, Caddy), `uvicorn --proxy-headers` MUST be used so that
            # `request.client.host` reflects the true client.
            # Otherwise, all users will share the same bucket and experience systemic DoS.
            # We intentionally do NOT blindly parse X-Forwarded-For here for safety in V1.
            ip = request.client.host if request.client else "unknown"
            now = time.monotonic()

            # Concurrency Note: There are no `await` yields between reading the history length
            # and appending the new timestamp. Dictionary mutations are synchronous and atomic
            # in asyncio, preventing race conditions on the rate limit boundary.
            self._cleanup(now)

            if ip not in self._history:
                self._history[ip] = []

            # Prune old timestamps for this IP
            self._history[ip] = [t for t in self._history[ip] if now - t <= 60.0]

            if len(self._history[ip]) >= self.rate_limit_per_minute:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                    headers={"Retry-After": "60"},
                )

            # Note: Invalid requests (422) intentionally consume quota
            # to prevent brute-force probing.
            self._history[ip].append(now)

        return await call_next(request)
