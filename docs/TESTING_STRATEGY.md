# Testing Strategy

## Overview
A robust testing strategy ensures V1 is reliable, regressions are caught early, and the deterministic recommendation engine functions as mathematically expected.

## Test Types

### 1. Backend Unit Tests
- **Focus**: Validation logic, utility functions, Pydantic model parsing.
- **Tools**: `pytest`.
- **Requirement**: Must run on every commit.

### 2. Recommendation Engine Tests (Crucial)
- **Focus**: Determinism and scoring logic.
- **Approach**: Mock a set of `AreaMetric` data in memory. Feed specific `RecommendationRequest` inputs and assert the exact expected `BLR Score` and rank order.
- **Requirement**: Any change to the scoring formula must not inadvertently break existing test assertions without deliberate recalibration.

### 3. Database / PostGIS Integration Tests
- **Focus**: Spatial queries (e.g., finding the nearest station, checking if a point is within a polygon).
- **Approach**: Spin up a temporary PostgreSQL+PostGIS test container. Seed with known GeoJSON boundaries. Query and assert spatial correctness.

### 4. API Integration Tests
- **Focus**: HTTP endpoints (`GET /areas`, `POST /recommend`).
- **Tools**: `FastAPI TestClient`.
- **Requirement**: Ensure HTTP status codes, error structures, and response schemas are correct.

### 5. Frontend Unit & Component Tests
- **Focus**: UI state, component rendering, and mapping logic.
- **Tools**: `Jest`, `React Testing Library`.
- **Requirement**: Ensure the preference sliders and map component render without crashing.

### 6. End-to-End (E2E) Tests
- **Focus**: The full user journey (Landing -> Search -> Results).
- **Tools**: `Playwright` or `Cypress`.
- **Requirement**: Run against a staging environment before any production deployment.

### 7. Data Pipeline Validation Tests
- **Focus**: Catching bad data before ingestion.
- **Requirement**: Scripts that import OSM or Rent data must fail if they detect null geometries, negative rents, or missing mandatory fields.

## CI/CD Blocking
- A pull request CANNOT be merged unless Backend Unit, Recommendation Engine, and API Integration tests pass.
- E2E tests must pass on the `main` branch before a production deployment is triggered.
