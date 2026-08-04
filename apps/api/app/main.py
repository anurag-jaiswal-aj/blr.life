from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.errors import validation_exception_handler
from app.core.logging import logger
from app.core.middleware import (
    ExceptionCatcherMiddleware,
    RateLimitMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from app.db.session import check_database_connection


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(f"Starting {settings.APP_NAME} in environment: {settings.ENVIRONMENT}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Exception handlers
# Note: Unhandled Exceptions are caught by ExceptionCatcherMiddleware to ensure
# they don't bypass outer custom middlewares.
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]

# Middlewares (Last added is first executed in FastAPI, so we add from inner to outer)

# 5. Exception Catcher (Innermost, catches unhandled exceptions from the router)
app.add_middleware(ExceptionCatcherMiddleware)

# 4. Rate Limiting
app.add_middleware(RateLimitMiddleware)

# 3. Security Headers
app.add_middleware(SecurityHeadersMiddleware)

# 2. CORS
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

# 1. Request ID (executes before most things to ensure logs are correlated)
app.add_middleware(RequestIDMiddleware)

# 0. Trusted Host
if settings.TRUSTED_HOSTS:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.TRUSTED_HOSTS,
    )

# 00. Proxy Headers (Executes absolute first to establish real client IP)
if settings.FORWARDED_ALLOW_IPS:
    app.add_middleware(
        ProxyHeadersMiddleware,
        trusted_hosts=settings.FORWARDED_ALLOW_IPS,
    )

app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health_check() -> dict[str, str]:
    """Process liveness health endpoint."""
    return {"status": "ok"}


@app.get("/ready", tags=["System"])
async def readiness_check(response: Response) -> dict[str, str]:
    """System readiness endpoint verifying database connectivity."""
    db_ok = await check_database_connection()
    if db_ok:
        return {"status": "ready", "database": "connected"}
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "not_ready", "database": "disconnected"}
