# Locality Geometry Audit

## 1. Inspection Summary
An inspection of the repository and database was conducted to determine the status of locality polygon geometries. The following sources were analyzed:
- **Database (`blr_life_db`)**: Queried the `locality` table to check the `geometry`, `geometry_source`, and `geometry_confidence` columns.
- **Seed Data (`data/curated/bengaluru_localities_v1.json`)**: Analyzed the curated JSON file which acts as the source of truth for database initialization.
- **Scripts & Migrations**: Reviewed `scripts/` for any ingestion logic and `apps/api/alembic/versions/` for database schema definitions.

**Findings:**
- The database schema supports geometry via PostGIS (e.g., `geometry`, `geometry_source`, `geometry_confidence`), but no external boundary files or GeoJSON datasets exist in the repository to populate them.
- `bengaluru_localities_v1.json` explicitly sets `"geometry": null` for all 37 localities.

## 2. Current Population
- **Total Localities with Non-Null Polygon Geometry**: 0
- **Locality Slugs with Geometry**: None
- **Locality Slugs with NULL Geometry**: All 37 localities
- **Geometry Type Stored**: N/A (All are `NULL`)
- **CRS/SRID Used**: N/A (All are `NULL`)

## 3. Provenance
Since no locality actually contains polygon geometry in the database, provenance for geometries is nonexistent. 

However, the metadata field `geometry_source` is populated for all 37 localities (sourced from `bengaluru_localities_v1.json`). 
- 8 localities are marked with a `geometry_source` of `osm_polygon`: `hsr-layout`, `jp-nagar`, `hebbal`, `bellandur`, `marathahalli`, `vasanth-nagar`, `jakkur`, `banaswadi`.
- The remaining 29 are marked as `osm_point`.

## 4. Comparison with Work Unit 3.5
The current state of the database and seed files was compared against `docs/BENGALURU_BOUNDARY_DATASET_EVALUATION.md` from Work Unit 3.5.

- **HSR Layout & JP Nagar**: Work Unit 3.5 confirmed these 2 localities as `POLYGON_CONFIRMED` in OSM. They are correctly marked as `osm_polygon` in the v1 seed data, but no actual polygon geometries are loaded into the database for them.
- **The 14 ward-only localities**: The evaluation concluded that 14 localities were `AMBIGUOUS` (administrative ward boundaries) and *must not* be treated as usable locality polygons. 
- **Conflict**: The `bengaluru_localities_v1.json` seed data incorrectly classifies 6 localities (`hebbal`, `bellandur`, `marathahalli`, `vasanth-nagar`, `jakkur`, `banaswadi`) with `geometry_source: "osm_polygon"`. According to the Work Unit 3.5 evaluation, only 2 out of the original ~8 were true locality polygons, meaning these 6 are administrative wards that should be reclassified as `osm_point` (or `AMBIGUOUS`) to adhere to the geography strategy.

## 5. Recommendations
1. **Fix Metadata Misclassification (Performed)**: Updated `data/curated/bengaluru_localities_v1.json` to change the `geometry_source` from `osm_polygon` to `osm_point` for the 6 localities that are merely ward boundaries (`hebbal`, `bellandur`, `marathahalli`, `vasanth-nagar`, `jakkur`, `banaswadi`). Only `hsr-layout` and `jp-nagar` retain the `osm_polygon` source metadata.
2. **Continue Point-Based Logic**: Since there are 0 localities with polygon geometry, the platform must continue relying entirely on the `centroid` (point-based) geospatial logic for distance calculations and rendering.
3. **Do Not Ingest External Boundaries**: Abide by the conclusion of Work Unit 3.5 to not ingest external ward boundary datasets, as they introduce severe conceptual mismatch with real-estate neighbourhoods.
