# Implementation Roadmap

**Target Timeline**: ~21 Development Days
**Goal**: Take blr.life from an empty repository to a public V1 launch.

## Phase 1: Foundation (Days 1-2)
- **Objective**: Establish documentation and base project structure.
- **Deliverables**: 
  - Complete all `/docs` markdown files.
  - Initialize Next.js project in `/frontend`.
  - Initialize FastAPI project in `/backend`.
  - Setup basic `docker-compose.yml` for local development.
- **Validation**: Containers start locally. Both servers return a 200 OK on root paths.
- **Checkpoint 1 & 2**: Foundation documentation & Repository/application foundation.

## Phase 2: Core Backend & Database (Days 3-6)
- **Objective**: Set up PostgreSQL + PostGIS, Alembic migrations, and core API routing.
- **Deliverables**:
  - `Area` and `AreaMetric` database tables via migrations.
  - CRUD endpoints for areas.
  - Pydantic schemas.
- **Validation**: Can insert a polygon via API and query it.
- **Checkpoint 3**: Core backend/database.

## Phase 3: Bengaluru Data & Geospatial Foundation (Days 7-10)
- **Objective**: Ingest real or highly realistic baseline data for Bengaluru.
- **Deliverables**:
  - Scripts to ingest major neighbourhood boundaries (GeoJSON).
  - Scripts to ingest Namma Metro stations.
  - Scripts to establish baseline `AreaMetric` data (rent ranges, commute anchors).
- **Validation**: Database contains ~50 areas with complete baseline metrics.
- **Checkpoint 4**: Bengaluru data/geospatial foundation.

## Phase 4: Recommendation Engine (Days 11-14)
- **Objective**: Build the core scoring and ranking logic.
- **Deliverables**:
  - Implementation of the BLR Score formula.
  - Endpoint `POST /recommend`.
  - Explanation generation logic.
  - Comprehensive unit tests for scoring accuracy.
- **Validation**: Postman/curl requests return a mathematically sound, ranked list with pros/cons.
- **Checkpoint 5**: Recommendation engine.

## Phase 5: End-to-End Product Flow (Days 15-18)
- **Objective**: Connect the frontend to the recommendation engine.
- **Deliverables**:
  - Landing page UI.
  - Constraint and Preference input forms (Sliders/Toggles).
  - Results page with interactive MapLibre map.
  - Shareable URL generation (encoding parameters in URL).
- **Validation**: Can complete the primary user journey entirely in the browser.
- **Checkpoint 6**: End-to-end product flow.

## Phase 6: Production Hardening & V1 Launch (Days 19-21)
- **Objective**: Prepare the system for public usage.
- **Deliverables**:
  - Rate limiting.
  - Production Docker builds (optimizing image size).
  - Setting up a basic VPS (e.g., DigitalOcean).
  - TLS/SSL configuration.
- **Validation**: System is accessible via the public internet securely, and E2E tests pass in production.
- **Checkpoint 7 & 8**: Production hardening & V1 launch.
