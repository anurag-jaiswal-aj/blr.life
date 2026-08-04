FROM python:3.13-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install dependencies only to cache the layer
COPY uv.lock pyproject.toml ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code and install project
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY README.md ./
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.13-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

RUN groupadd -r appgroup && useradd -r -g appgroup appuser

COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appgroup /app/app /app/app
COPY --from=builder --chown=appuser:appgroup /app/alembic /app/alembic
COPY --from=builder --chown=appuser:appgroup /app/alembic.ini /app/alembic.ini

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
