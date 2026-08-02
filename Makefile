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
