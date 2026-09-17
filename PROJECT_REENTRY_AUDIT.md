# BLR.LIFE V1 - PROJECT REENTRY AUDIT

## 1. Executive Summary
The `blr.life` project has reached a clean stabilization point following Phase 1 (Product Integrity) and Phase 2 (Transit/Metro Integration). The Git tree is pristine, and CI pipelines (linting, typing, frontend tests) are entirely green. However, a major blocker prevents a production launch: **Data Quality**. The application currently only has 2 real rent observations in the database, making the affordability filters practically non-functional. The next logical phase is addressing Data Completeness before launching to users.

## 2. Current Git State
- **Branch**: `main`
- **HEAD**: `5877152 chore(ci): reduce database backup artifact retention to 14 days`
- **Synchronization**: Local is fully synchronized with `origin/main`.
- **Status**: Pristine working tree. 0 untracked files. 0 uncommitted changes.
- **Recent Milestones**:
  - `5877152`: Adjusted DB backup retention.
  - `51ea6bf`, `89ba6b1`, `4ac1f0e`: Major CI stability & backup configuration fixes.
  - `d213750`: Phase 2 Transit integration.
  - `7fbeddf`: Phase 1 Semantic Honesty & Missing Data fixes.
  - `73d92d0`: Implemented Desktop Workspace layout.

## 3. Repository Architecture
The repository uses a monorepo structure:
- `/apps/api`: Python (FastAPI, SQLAlchemy, Alembic, PostGIS) backend.
- `/apps/web`: TypeScript (Next.js App Router, Tailwind, Lucide React, Vitest) frontend.
- `/data`: Raw data assets (GeoJSON, seed scripts).
- `/docs`: Comprehensive project strategy and planning markdown.
- `/.github/workflows`: Automated CI checks and Neon database backups.
- `docker-compose.yml`: Local orchestrator for DB, API, and Web.

## 4. Product Definition
1. **Problem**: Deciding where to live in Bengaluru is overwhelming due to extreme traffic, fragmented rent data, and lifestyle priorities.
2. **Target User**: Renters moving to or within Bengaluru (professionals, expats, students).
3. **V1 Scope**: Recommending *areas/localities*, not specific housing units, based on a single work location, budget, and lifestyle weights.
4. **Core Journey**: User inputs office coordinates, rent budget, and weights -> API scores/ranks localities -> Map and list visualize recommendations -> Click for details (pros/cons).
5. **Recommendation System**: Calculates a deterministic `BLR Score` utilizing normalized spatial distance, metro access, and aggregated amenity accessibility.
6. **Locality Data**: Geographic polygons (PostGIS points/boundaries), derived amenity counts, average rent bands, and metro proximity.
7. **Inputs**: Work location (Lat/Lng), Max Budget, BHK Type, Lifestyle weights (Commute, Metro, Cafes, Parks, etc.).
8. **Outputs**: Ranked list of localities with sub-scores, rank, pros/warnings.
9. **Map**: Interactive MapLibre instance showing work marker and top recommended areas dynamically.
10. **Detail View**: Provides human-readable breakdown of the score and warnings (e.g., missing data alerts).
11. **Confidence/Provenance**: Displays transparent missing-data alerts and tracks which algorithm version produced the score.
12. **Anti-goals**: No user accounts, no routing matrix APIs (using heuristic distance instead), no real estate listings.

## 5. Documentation/Plan Reconciliation
- **V1_SCOPE.md**: Generally aligns with current implementation.
- **IMPLEMENTATION_ROADMAP.md**: Outdated. We are technically past Phase 6 (Production Hardening), but blocked by Data phases.
- **PRODUCT_REQUIREMENTS.md**: Assumed widespread rent availability; current implementation is failing this assumption due to lack of data.
- **Missing Documentation Update**: The frontend recently shifted from a single-column layout to a sophisticated 3-pane map/list desktop layout (`73d92d0`) which isn't fully captured in early wireframe descriptions.

## 6. Frontend Audit
- **Framework**: Next.js (App Router), React, Tailwind, MapLibre-GL.
- **Structure**: 
  - `page.tsx`: Houses the primary `RecommendationWorkspace`.
  - `ResultCard.tsx`, `NeighbourhoodDetail.tsx`, `ControlsPanel.tsx`, `MapContainer.tsx`.
- **State**: Strictly URL-based state (`useUrlState.ts`) for shareability.
- **API Client**: `fetchRecommendations` in `lib/api.ts`.
- **Match vs Reality**: Implemented features match Phase 1 requirements exactly. Unsupported budget features are gracefully hidden when missing. "Commute" language was successfully refactored to spatial distance semantics.
- **Technical Debt**: 
  - Minor unused Lucide icon imports (`eslint` warnings in components).
  - Vitest configuration throwing ESM module warnings.

## 7. Backend Audit
- **Framework**: FastAPI (Async).
- **Core Engine**: `apps/api/app/services/recommendation.py`.
- **Scoring**: Uses deterministic weighted sum. Amenities are normalized using min/max scaling. Missing metrics correctly contribute `0` to the numerator while weights remain in the denominator (implemented in Phase 1).
- **Spatial**: Heavy reliance on PostGIS (`ST_DistanceSphere`).
- **Data Quality Alerts**: Warnings array in `explanations` surfaces missing rent or distant transit.
- **Consistency**: The API contract strictly enforces `RecommendationResponse` and `RecommendationResult` with component scores.

## 8. Database Audit
- **ORM**: SQLAlchemy + Alembic.
- **Extensions**: PostGIS (`3.4.3`).
- **Current Alembic HEAD**: `60753185ce9f` (Added metro line/operational flags).
- **Current Live Data (Local Verify)**:
  - `locality`: **37**
  - `metro_station`: **65**
  - `locality_metric`: **222**
  - `locality_rent_observation`: **2**

## 9. Data Quality Audit
**Status: CRITICAL BLOCKER**
- **Geospatial Coverage (Localities)**: 37 areas. (Sufficient for MVP).
- **Transit (Metro)**: 65 stations. (Excellent coverage).
- **Amenities**: 222 metrics (Average 6 metrics per locality, reasonably good).
- **Rent Affordability**: **2 observations total.** 
  - *Finding*: The product promises affordability constraints, but the database cannot support this. The system currently masks this via Phase 1 missing-data overrides, but the core product promise of "budget-based matching" is impossible with 2 observations.

## 10. Testing Audit
- **Frontend**: 63/63 Tests passing (`npm run test -- --run`). Typecheck and Lint passing (with minor unused-var warnings).
- **Backend**: Ruff checks and formatting strictly pass. `pytest` passes **only** when the local docker database (`blr_life_db`) is running. It fails catastrophically with `Connection refused` if run bare-metal without the DB dependency.

## 11. CI/CD Audit
- **GitHub Actions**: Pipeline ensures frontend/backend pass on push.
- **Database Backup (`db_backup.yml`)**: 
  - Triggers daily via cron.
  - Successfully pulls `pg_dump` via `postgresql-client-18`.
  - Retains artifacts explicitly for **14 days**.
  - Restorability successfully verified in an isolated local container.

## 12. Deployment Audit
- **Environment**: Docker-compose prepared for production deployment (`docker-compose.prod.yml`).
- **Vercel/API**: The API URL is injected via `NEXT_PUBLIC_API_URL` to connect Next.js statically to the FastAPI container. 
- **Database**: Neon (PostgreSQL 18.4) serves as the production datastore.

## 13. Security/Privacy Audit
- **Secrets**: No secrets are committed. `.env.example` is clean. 
- **CORS**: Correctly configured to allow local and intended production origins.
- **Data Persistence**: No personally identifiable user information is stored. Work locations (Lat/Lng) are processed ephemerally.

## 14. Product Integrity Audit
The application successfully adheres to Semantic Honesty constraints established in Phase 1:
- "Distance" is correctly labeled rather than fake "Commute Time".
- Missing data lowers scores mathematically, avoiding false positives.
- Explanations (`explanations.warnings`) inform the user when data is absent.
- The UI gracefully falls back rather than breaking or lying when rent data is unavailable.

## 15. Feature Matrix

| Feature | Planned | Implemented | Tested | Data Available | Production Ready | Evidence |
|---|---|---|---|---|---|---|
| Basic Area DB | Yes | Yes | Yes | Yes (37) | Yes | `locality` table count |
| Metro/Transit | Yes | Yes | Yes | Yes (65) | Yes | `metro_station` integration |
| Amenity Scoring | Yes | Yes | Yes | Yes | Yes | `locality_metric` processing |
| Work Location Search | Yes | Yes | Yes | Yes | Yes | Next.js Geocode API proxy |
| **Rent Scoring/Filter** | Yes | Yes | Yes | **NO (2 obs)** | **NO** | `rent_observation` count |
| Shareable URLs | Yes | Yes | Yes | N/A | Yes | `useUrlState.ts` |
| Interactive Map | Yes | Yes | Yes | N/A | Yes | MapLibre implementation |
| Desktop Workspace | Yes | Yes | Yes | N/A | Yes | `73d92d0` commit |

## 16. Development History
- **Initial Build**: Rapid prototype of FastApi + Next.js with placeholder algorithms.
- **Phase 1 (Integrity)**: Identified severe mathematical flaws in missing-data handling and deceptive "commute" labels. Refactored scoring and UI transparency.
- **UX Pivot**: Abandoned single-column mobile-first layout for a robust 3-pane desktop workspace.
- **Phase 2 (Transit)**: Ingested and integrated Metro station data into the deterministic scoring algorithm.
- **DevOps Refinement**: Configured Postgres 18 Neon backups, verified restorability, reduced artifact retention to 14 days, and finalized CI pipelines.

## 17. Completed Work
- Fully responsive Map/List workspace UI.
- URL-driven application state.
- PostGIS database architecture and Alembic schema.
- Deterministic, mathematically sound recommendation API.
- Verified and automated database backup strategy.

## 18. Partial Work
- E2E testing exists but backend integration tests require a running database, coupling them tightly to local environment states.

## 19. Missing Work
- **Rent Data Ingestion Pipeline**: There is no script/system currently populating real rent observation data across the city.

## 20. Technical Debt
- Vitest configuration throws ESM Native Loader warnings.
- 10 Unused variables in Frontend React components.
- Pytest suite fails instantly without a local DB (no test-db mocking/fixture isolation).

## 21. Outdated Documentation
- `IMPLEMENTATION_ROADMAP.md` reflects the initial optimistic ~21 day sprint, not the current phased data reality.

## 22. Unknowns / Questions
- Where will the rent observation data be sourced from (Scraping, civic data, crowd-sourced)?
- Will the production VPS support the current container resource footprint?

## 23. Recommended Next Roadmap

**Phase A — Data Completeness (Rent & Affordability)**
- *Objective*: Populate `locality_rent_observation` with realistic data for all 37 localities.
- *Why*: The application is fundamentally broken for budget-conscious users without this data.
- *Validation*: Minimum 5 rent observations per BHK type per locality.

**Phase B — UX Polish & Tech Debt**
- *Objective*: Clean up ESLint warnings, fix Vitest warnings, ensure loading/empty states are flawless.
- *Why*: Final layer of polish before public eyes.

**Phase C — Production Deployment & Launch**
- *Objective*: Deploy containers to VPS, finalize Neon connection strings, map domains, and launch.
- *Why*: Product is mathematically and functionally sound; missing data is the only barrier.

## 24. Exact Recommended Next Step
**DO NOT WRITE CODE YET.** 
The exact next step is to initiate **Phase A (Data Completeness)** by identifying the data source for Bengaluru rents, writing a targeted ingestion script for `locality_rent_observation`, and populating the database to achieve critical mass for the recommendation engine's affordability filter.
