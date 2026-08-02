# blr.life

*Bengaluru, made easier.*

**blr.life** is a Bengaluru living-intelligence and location-intelligence platform. It aims to answer one primary question: Given your workplace, housing budget, office frequency, and lifestyle priorities, where should you live in Bengaluru?

## Problem Statement
Finding the right neighbourhood in Bengaluru is notoriously difficult. It involves complex tradeoffs between rent, commute times, metro access, and lifestyle preferences. Existing platforms either provide generic real-estate listings without commute/lifestyle context or rely on subjective, non-data-driven opinions.

## V1 Objective
Deliver a fast, intuitive web application where users can input their workplace, budget, and preferences to receive a ranked, data-driven, and highly explainable list of recommended Bengaluru neighbourhoods.

## Planned Technology Stack
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Python, FastAPI, Pydantic, SQLAlchemy, Alembic
- **Database**: PostgreSQL with PostGIS for geospatial queries
- **Maps**: MapLibre (open-source approach)
- **Infrastructure**: Docker & Docker Compose (Modular Monolith)

## High-Level Architecture
The system is designed as a modular monolith. The Next.js frontend communicates via REST with a FastAPI backend. The backend manages domains such as `users`, `areas`, `locations`, `datasets`, and `recommendations`. A deterministic recommendation engine queries the PostGIS database to generate scored and explainable neighbourhood recommendations based on hard constraints and weighted preferences.

## Repository Status
⚠️ **STATUS: FOUNDATION & PLANNING STAGE** ⚠️
This repository currently contains only foundational engineering and product documentation. No application source code has been implemented yet. 

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
