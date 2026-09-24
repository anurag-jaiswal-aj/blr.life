# blr.life V1 Release Readiness Audit

## 1. Scope
This read-only audit evaluates the current repository state to identify what is required to take the completed V1 application toward production deployment, focusing on environment variables, configuration, external dependencies, security, and CI/CD pipelines.

## 2. Current V1 Status
V1 engineering is officially complete. The core implementation phases (1-6) are finished, and the repository is structurally prepared for the deferred post-V1 deployment phase.

## 3. Environment Configuration
Environment configuration is explicitly defined in `.env.example` and parsed strictly by `apps/api/app/core/config.py`.

- **REQUIRED_PRODUCTION**: 
  - `DATABASE_URL` (Neon PostgreSQL connection string)
  - `ENVIRONMENT=production`
  - `CORS_ORIGINS` (Must strictly match the Vercel domain)
  - `TRUSTED_HOSTS` & `FORWARDED_ALLOW_IPS` (Security headers for the reverse proxy)
  - `NEXT_PUBLIC_API_BASE_URL` (The public URL of the Render backend)
  - `NOMINATIM_USER_AGENT` (Must be a valid identifying string per OSM policy)
- **DEVELOPMENT_ONLY**: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (used for local docker-compose bootstrap).
- **Issue Resolved**: The previous mismatch in the frontend API URL variable (`NEXT_PUBLIC_API_URL` vs `NEXT_PUBLIC_API_BASE_URL`) has been fully resolved. `NEXT_PUBLIC_API_BASE_URL` is now the single canonical variable across all runtime code, Docker configurations, CI pipelines, and documentation.

## 4. Database Readiness
- **State**: Alembic migrations are ordered and fully tested.
- **Extensions**: PostGIS is required and enabled via the first migration.
- **Seed Data**: `make bootstrap` commands are available to ingest verified canonical localities, amenities, and metro stations.
- **Safety**: No destructive operations run on startup. Migrations must be explicitly applied.

## 5. Backend Readiness
- **Server**: FastAPI runs via Uvicorn. The `Dockerfile` correctly exposes port 8000 and runs as a non-root user.
- **Security**: Strict CORS middleware, RateLimiting middleware (default 10 req/min), and Proxy Headers middleware are active.
- **Health**: `/health` and `/ready` endpoints are implemented and actively smoke-tested in CI.
- **Graceful Failure**: Fallbacks for missing geometry and missing rent data are handled safely.

## 6. Frontend Readiness
- **Build**: Next.js production builds are verified in CI using multi-stage Docker builds. 
- **Map Tiles**: Migrated to OpenFreeMap, safely removing the dependency on restricted/commercial tile providers.
- **API Communication**: Relies entirely on the `NEXT_PUBLIC_API_BASE_URL` environment variable at build and runtime.

## 7. Security Readiness
- **Secrets**: No secrets are hardcoded in the repository.
- **SQL Injection**: Prevented via SQLAlchemy parameterized queries.
- **Container Security**: The CI pipeline explicitly verifies that both frontend and backend Docker containers do not run as the `root` user.
- **OSM Compliance**: Geocoding requests to Nominatim are proxied through the backend, cached, paced (timeout 10s), and tagged with a custom User-Agent to avoid IP bans.

## 8. External Dependencies
- **Neon (Database)**: Required for PostgreSQL + PostGIS. Compatible with ₹0 constraint (Free tier).
- **Render (Backend)**: Required for Docker container hosting. Cold starts (~45s) are a known limitation on the free tier.
- **Vercel (Frontend)**: Required for Next.js hosting.
- **Nominatim (Geocoding)**: OpenStreetMap API used for geocoding workplace locations. ₹0 compatible but strictly governed by usage policies (handled by backend proxying).
- **OpenFreeMap (Map Tiles)**: Provides vector tiles directly to MapLibre. ₹0 compatible.

## 9. CI/CD Readiness
The `.github/workflows/ci.yml` is exceptionally robust:
- Validates Python (`ruff`, `mypy`, `pytest`) and Node (`eslint`, `tsc`, `vitest`, `playwright`).
- Builds both production Docker containers.
- Spins up a temporary PostGIS database, runs Alembic migrations, and boots the backend container to verify connectivity.
- Boots the frontend container and curls the root path to verify successful SSR and API binding.
- Verifies that neither container runs as `root`.
- Blocks merging if any check fails.

## 10. Production Deployment Blockers

### Blockers
- **None**: The environment variable inconsistency has been resolved.

### Required Decisions
- **Sparse Rent Data Acceptance**: Only 2/37 localities currently have verified rent data. While the engine handles this safely (failing open), product leadership must explicitly decide if this sparse coverage is acceptable for the V1 public launch.

### Ready
- Container Images (Non-root, optimized)
- CI/CD Validation Pipeline
- Database Schema & Migrations
- Security Middlewares (CORS, Rate Limiting)
- OSM-Compliant Map Tiles and Geocoding

### Deferred
- Live Traffic Routing (OSRM)
- Complete Locality Polygon Geometries
- Widespread Rent Data Scraping

## 11. Release Checklist
- [x] Resolve `NEXT_PUBLIC_API_URL` vs `NEXT_PUBLIC_API_BASE_URL` inconsistency.
- [ ] Confirm product acceptance of sparse rent data for V1 launch.
- [ ] Provision Neon Database and run `alembic upgrade head`.
- [ ] Provision Render Web Service with correct environment variables.
- [ ] Provision Vercel project with correct environment variables.
- [ ] Execute `make bootstrap` against the production database to seed initial data.

## 12. Recommended Next Release-Readiness Work Unit
**Determine Product Acceptance of Sparse Rent Data** (or proceed directly to deployment provisioning).
