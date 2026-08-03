# Locality Intelligence Foundation (V1)

This document outlines the intelligence signals gathered and computed for each Bengaluru locality in blr.life V1, providing the quantitative foundation for the recommendation engine.

## Core Philosophy

blr.life never fabricates precision. We strictly adhere to defensible, open, and mathematically sound data sources. When data is unavailable, we explicitly state its absence rather than inventing numbers. The intelligence pipeline is designed to be deterministic, idempotent, and explainable.

## Signals Implemented (V1)

### 1. Metro Proximity (`metro_distance_m`)
- **Metric Type**: Objective distance metric.
- **Description**: The straight-line distance (in meters) from a locality's centroid to the nearest active Namma Metro station.
- **Source**: OpenStreetMap (OSM) via Overpass API.
- **Licensing**: Open Data Commons Open Database License (ODbL).
- **Operational Curation Policy**: OSM geographic facts and tagging are NOT treated as absolute proof of passenger operation. V1 metrics consider *only* stations strictly operational for passenger service. Because future/under-construction stations (e.g., Yellow, Pink, Blue lines) are frequently pre-mapped in OSM with ambiguous tagging, they are manually excluded. This exclusion list is a deliberately maintained policy layer (in `scripts/extract_metro_stations.py`), not an automated operational-status inference. Manual exclusions can become stale and must be reviewed when regenerating the dataset. The authoritative list relies on this manual curation to prevent future extensions from inappropriately influencing V1 metrics before they open.
- **Confidence**: `HIGH`. Coordinates are deterministic and mathematically computed via PostGIS `ST_Distance(geography, geography)`.
- **Explainability**: The `locality_metric` row includes an `extra_data` JSONB payload containing the exact name and slug of the nearest station (e.g., `{"nearest_station_slug": "indiranagar-metro", "nearest_station_name": "Indiranagar"}`) so the UI can explicitly state "1.2km from Indiranagar Metro".
- **Limitations**: Currently computes straight-line spatial distance. Walkable network routing will be introduced in future work units.

### 2. Amenity Accessibility (1500m Centroid Radius)
- **Metric Types**: `cafe_accessibility`, `restaurant_accessibility`, `park_accessibility`, `healthcare_accessibility`, `nightlife_accessibility`.
- **Description**: The absolute count of active Points of Interest (POIs) within a strict 1500-meter straight-line radius of the locality's centroid.
- **Source**: OpenStreetMap (OSM) via Overpass API.
- **Licensing**: Open Data Commons Open Database License (ODbL). The underlying OSM identity (e.g. `node/12345`) is preserved to maintain provenance.
- **Operational Curation Policy**: We do not calculate "density" (count per square km) because precise locality polygons are deferred. Instead, we use a uniform "centroid-based accessibility" buffer (1500m). Ingestion pipelines use stable OSM identities to deterministically upsert POIs. If an authoritative extraction omits an existing POI, the pipeline performs *Stale POI Reconciliation* by marking the omitted POI as inactive, ensuring the database accurately reflects upstream deletions without destroying history.
- **Confidence**: `MEDIUM`. Straight-line radial distance accurately reflects the existence of amenities within the catchment area, though true walkable network distances may vary.

## Signals Deferred (V1)

### 1. Rent / Affordability
- **Status**: **NO-GO (Deferred)**
- **Reasoning**: We lack a zero-cost, legally redistributable, highly precise dataset for rent bounds across all 37 Bengaluru localities and housing configurations (1BHK, 2BHK, etc.). Scraping commercial real estate portals (e.g., NoBroker, MagicBricks) violates our strict legal guidelines. Using stale open datasets (e.g., 2021 Kaggle data) provides dangerously misleading market representations.
- **Handling**: The recommendation engine accepts budget inputs but will gracefully report "Insufficient rent data" where applicable, prioritizing commute and lifestyle preferences instead.

### 2. Precise Polygon Density
- **Status**: **DEFERRED**
- **Reasoning**: We lack legally redistributable, verified boundary polygons for all canonical V1 localities. Without boundaries, calculating area-based density is impossible. Instead, we rely on the mathematically verifiable centroid accessibility metrics described above.

## Pipeline Architecture

The intelligence foundation consists of two distinct offline processes to maintain architectural cleanliness:

1. **`ingest-metro-data`**: Deterministically upserts the curated 65 Namma Metro stations into the `metro_station` table, linking them to a `dataset_snapshot` for provenance.
2. **`calculate-metro-metrics`**: Executes a bulk PostGIS query computing the nearest metro station for all active localities and upserts the result into the `locality_metric` table. It stamps each row with a `calc_version` to support historical auditing.
3. **`ingest-amenities`**: Deterministically upserts OSM amenities, deduplicates identical `osm_id` records, and reconciles stale POIs (marking them inactive).
4. **`calculate-amenity-metrics`**: Executes PostGIS queries counting active POIs within 1500m (`ST_DWithin`) of each locality centroid, intelligently updating metrics only when counts or confidences change to track history.
These commands support `--dry-run` execution to guarantee development safety.
