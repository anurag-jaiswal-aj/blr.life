.PHONY: up down logs ps migrate test lint format typecheck

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

migrate:
	docker compose exec api alembic upgrade head

test:
	cd apps/api && uv run pytest
	cd apps/web && npm run test

lint:
	cd apps/api && uv run ruff check .
	cd apps/web && npm run lint

format:
	cd apps/api && uv run ruff format .
	cd apps/web && npm run lint

typecheck:
	cd apps/api && uv run mypy app
	cd apps/web && npm run typecheck

# -----------------------------------------------------------------------------
# Data Ingestion
# -----------------------------------------------------------------------------
# We use the integration test database to prevent accidental pollution of the dev db.
ingest-synthetic-dry-run:
	cd apps/api && DATABASE_URL="postgresql+asyncpg://blrlife:blrlife_dev_password@localhost:5432/blrlife_test" uv run python -m app.ingestion.cli ingest --file tests/fixtures/synthetic_ingestion.json --dry-run

ingest-synthetic:
	cd apps/api && DATABASE_URL="postgresql+asyncpg://blrlife:blrlife_dev_password@localhost:5432/blrlife_test" uv run python -m app.ingestion.cli ingest --file tests/fixtures/synthetic_ingestion.json

validate-localities:
	cd apps/api && DATABASE_URL="postgresql+asyncpg://blrlife:blrlife_dev_password@localhost:5432/blrlife_test" uv run python -m app.ingestion.cli ingest --file ../../data/curated/bengaluru_localities_v1.json --dry-run

ingest-real-dry-run:
	cd apps/api && DATABASE_URL="postgresql+asyncpg://blrlife:blrlife_dev_password@localhost:5432/blrlife_test" uv run python -m app.ingestion.cli ingest --file ../../data/curated/bengaluru_localities_v1.json --dry-run

ingest-real:
	cd apps/api && uv run python -m app.ingestion.cli ingest --file ../../data/curated/bengaluru_localities_v1.json

ingest-metro-dry-run:
	cd apps/api && DATABASE_URL="postgresql+asyncpg://blrlife:blrlife_dev_password@localhost:5432/blrlife_test" uv run python -m app.ingestion.cli ingest-metro-data --file ../../data/curated/bengaluru_metro_stations_v1.json --dry-run

ingest-metro:
	cd apps/api && uv run python -m app.ingestion.cli ingest-metro-data --file ../../data/curated/bengaluru_metro_stations_v1.json

calculate-metrics-dry-run:
	cd apps/api && DATABASE_URL="postgresql+asyncpg://blrlife:blrlife_dev_password@localhost:5432/blrlife_test" uv run python -m app.ingestion.cli calculate-metro-metrics --dry-run

calculate-metrics:
	cd apps/api && uv run python -m app.ingestion.cli calculate-metro-metrics
