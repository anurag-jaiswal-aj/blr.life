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

## Signals Deferred (V1)

### 1. Rent / Affordability
- **Status**: **NO-GO (Deferred)**
- **Reasoning**: We lack a zero-cost, legally redistributable, highly precise dataset for rent bounds across all 37 Bengaluru localities and housing configurations (1BHK, 2BHK, etc.). Scraping commercial real estate portals (e.g., NoBroker, MagicBricks) violates our strict legal guidelines. Using stale open datasets (e.g., 2021 Kaggle data) provides dangerously misleading market representations.
- **Handling**: The recommendation engine accepts budget inputs but will gracefully report "Insufficient rent data" where applicable, prioritizing commute and lifestyle preferences instead.

### 2. OSM Amenity Densities (Cafes, Parks, Healthcare)
- **Status**: **DEFERRED**
- **Reasoning**: True amenity density calculations (amenities per square kilometer) require precise locality bounding polygons. Our current registry utilizes point `centroid_wkt` geometries. Faking locality boundaries using arbitrary equal-radius circles around centroids violates our "no fabricated precision" rule. 
- **Next Steps**: Amenity metrics will be implemented in a subsequent work unit after precise Locality `MultiPolygon` definitions are curated and ingested.

## Pipeline Architecture

The intelligence foundation consists of two distinct offline processes to maintain architectural cleanliness:

1. **`ingest-metro-data`**: Deterministically upserts the curated 65 Namma Metro stations into the `metro_station` table, linking them to a `dataset_snapshot` for provenance.
2. **`calculate-metro-metrics`**: Executes a bulk PostGIS query computing the nearest metro station for all active localities and upserts the result into the `locality_metric` table. It stamps each row with a `calc_version` to support historical auditing.

These commands support `--dry-run` execution to guarantee development safety.
