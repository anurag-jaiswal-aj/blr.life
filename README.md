# blr.life

*Bengaluru, made easier.*

**blr.life** is a Bengaluru living-intelligence and location-intelligence platform. It aims to answer one primary question: Given your workplace, housing budget, office frequency, and lifestyle priorities, where should you live in Bengaluru?

## Problem Statement
Finding the right neighbourhood in Bengaluru is notoriously difficult. It involves complex tradeoffs between rent, commute times, metro access, and lifestyle preferences. Existing platforms either provide generic real-estate listings without commute/lifestyle context or rely on subjective, non-data-driven opinions.

## V1 Objective
Deliver a fast, intuitive web application where users can input their workplace, budget, and preferences to receive a ranked, data-driven, and highly explainable list of recommended Bengaluru neighbourhoods.

## Technology Stack
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Vitest
- **Backend**: Python 3.11+, FastAPI, Pydantic Settings, SQLAlchemy 2.x, Alembic, pytest, Ruff, mypy
- **Database**: PostgreSQL with PostGIS extension
- **Infrastructure**: Docker & Docker Compose (Modular Monolith)

## High-Level Architecture
The system is designed as a modular monolith. The Next.js frontend (`apps/web`) communicates via REST with a FastAPI backend (`apps/api`). The backend connects to PostgreSQL + PostGIS for geospatial and metric queries.

## Repository Status
🟢 **STATUS: APPLICATION FOUNDATION STAGE** 🟢
The executable application foundation is running. Frontend, backend, database migrations, and testing infrastructures are configured. Product features (recommendations, maps, area data) will be built in subsequent work units.

## Prerequisites
- Node.js v20+ & npm v10+
- Python 3.11+ & `uv` (recommended)
- Docker & Docker Compose

## Local Development Quick Start

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

### 4. Code Quality & Testing Commands
```bash
make lint       # Runs Ruff (backend) & ESLint (frontend)
make format     # Formats Python backend code
make typecheck  # Runs mypy (backend) & tsc (frontend)
make test       # Runs pytest (backend) & Vitest (frontend)
```

## Expected Local Endpoints
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Liveness Health Check**: [http://localhost:8000/health](http://localhost:8000/health)
- **Database Readiness Check**: [http://localhost:8000/ready](http://localhost:8000/ready)

## Documentation Index
All foundational documentation is located in the `docs/` directory:

- [Product Requirements](docs/PRODUCT_REQUIREMENTS.md)
- [V1 Scope](docs/V1_SCOPE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Domain Model](docs/DOMAIN_MODEL.md)
- [Data Strategy](docs/DATA_STRATEGY.md)
- [Recommendation Engine](docs/RECOMMENDATION_ENGINE.md)
- [Security](docs/SECURITY.md)
- [Testing Strategy](docs/TESTING_STRATEGY.md)
- [Engineering Guidelines](docs/ENGINEERING_GUIDELINES.md)
- [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md)
