# blr.life

*Bengaluru, made easier.*

**blr.life** is a Bengaluru living-intelligence and location-intelligence platform. It aims to answer one primary question: Given your workplace, housing budget, office frequency, and lifestyle priorities, where should you live in Bengaluru?

## Overview

Finding the right neighbourhood in Bengaluru is notoriously difficult. It involves complex tradeoffs between rent, commute times, metro access, and lifestyle preferences. Existing platforms either provide generic real-estate listings without commute/lifestyle context or rely on subjective, non-data-driven opinions.

blr.life delivers a fast, intuitive web application where users can input their workplace, budget, and preferences to receive a ranked, data-driven, and highly explainable list of recommended Bengaluru neighbourhoods.

## Key Features

- **Deterministic Scoring**: Data-driven ranking system prioritizing proximity, metro access, and curated lifestyle amenities.
- **Explainable Recommendations**: Transparent breakdown of why a locality was recommended, including warnings for missing data.
- **Interactive Map**: High-performance vector map rendering with dynamic work and recommendation markers.
- **Responsive Workspace**: Advanced 3-pane desktop workspace that allows simultaneous map exploration and detail viewing, with a mobile-optimized sheet interface.
- **Shareable Links**: URL-based application state for easily sharing location research with roommates or family.

## Architecture

The system is designed as a modular monolith optimized for a zero-cost serverless deployment. The Next.js frontend communicates via REST with a FastAPI backend. The backend connects to PostgreSQL + PostGIS for complex geospatial distance and metric queries.

## Technology Stack

- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, Lucide React
- **Backend**: Python 3.11+, FastAPI (Async), Pydantic, SQLAlchemy 2.x, Alembic
- **Database**: PostgreSQL with PostGIS extension
- **Map Architecture**: MapLibre GL JS with OpenFreeMap vector tiles
- **Testing & Tooling**: Vitest, pytest, Ruff, mypy, ESLint

## Recommendation Engine

The core backend recommendation algorithm is deterministic:
1. **Locality Data**: Geographic polygons (PostGIS points/boundaries), derived amenity counts, average rent bands, and metro proximity.
2. **Inputs**: Work location (Lat/Lng), Max Budget, BHK Type, Lifestyle weights (Commute, Metro, Cafes, Parks, etc.).
3. **Scoring**: Calculates a `BLR Score` utilizing normalized spatial distance, metro access, and aggregated amenity accessibility via min/max scaling. Missing metrics correctly contribute `0` to the numerator while weights remain in the denominator.
4. **Outputs**: Ranked list of localities with sub-scores, rank, and human-readable pros/warnings.

## Local Development Setup

### Prerequisites
- Node.js v20+ & npm v10+
- Python 3.11+ & `uv` (recommended)
- Docker & Docker Compose

### 1. Environment Setup
```bash
cp .env.example .env
```

### 2. Docker Compose (Recommended)
```bash
make up
make bootstrap
```

### 3. Local Development (Without Docker)

**Backend Setup:**
```bash
cd apps/api
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

**Frontend Setup:**
```bash
cd apps/web
npm install
npm run dev
```

## Environment Variables

| Variable | Environment | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Backend | YES | PostgreSQL connection string (must use `postgresql+asyncpg://` schema). |
| `ENVIRONMENT` | Backend | YES | Set to `development` or `production`. |
| `CORS_ORIGINS` | Backend | YES | Allowed CORS origins (e.g. `["http://localhost:3000"]`). |
| `TRUSTED_HOSTS` | Backend | YES | Allowed Host headers (e.g. `["*"]`). |
| `FORWARDED_ALLOW_IPS` | Backend | YES | Proxy trust for rate-limiting (e.g. `127.0.0.1`). |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | YES | The URL pointing to the FastAPI backend. |
| `NOMINATIM_USER_AGENT` | Frontend | YES | Identifies geocoding requests to OSM Nominatim. |

*(Note: Production MapLibre rendering uses OpenFreeMap; no Mapbox API token is required.)*

## Deployment

The production architecture is deployed using the following platforms:
- **Frontend**: [Vercel](https://vercel.com/)
- **Backend**: [Render](https://render.com/) (Web Service - Docker)
- **Database**: [Neon](https://neon.tech/) (PostgreSQL + PostGIS)

Detailed deployment instructions, database configurations, and zero-cost scaling analyses are available in `docs/DEPLOYMENT.md` and `docs/PRODUCTION_READINESS_AUDIT.md`.

## Testing & Quality

```bash
make lint       # Runs Ruff (backend) & ESLint (frontend)
make format     # Formats Python backend code
make typecheck  # Runs mypy (backend) & tsc (frontend)
make test       # Runs pytest (backend) & Vitest (frontend)
```

## Project Structure

- `apps/api/`: Python FastAPI backend.
- `apps/web/`: TypeScript Next.js frontend.
- `data/`: Raw data assets (GeoJSON, seed scripts).
- `docs/`: Comprehensive architecture and deployment planning documentation.
- `scripts/`: Data ingestion and validation utilities.

## Documentation

All foundational documentation is located in the `docs/` directory:
- [Architecture](docs/ARCHITECTURE.md)
- [Domain Model](docs/DOMAIN_MODEL.md)
- [Data Strategy](docs/DATA_STRATEGY.md)
- [Recommendation Engine](docs/RECOMMENDATION_ENGINE.md)
- [Security](docs/SECURITY.md)
- [Testing Strategy](docs/TESTING_STRATEGY.md)

## License

This project is open-source and available under the MIT License.
