# Database Schema (Work Unit #4: Domain Persistence & PostGIS Foundation)

This document describes the concrete PostgreSQL / PostGIS database schema implemented for **blr.life** V1.

---

## 1. Overview

The domain persistence layer uses:
- **Database Engine**: PostgreSQL 16+ with PostGIS extension.
- **ORM / DDL**: SQLAlchemy 2.x, GeoAlchemy2, and Alembic.
- **Driver Model**: Runtime API uses `asyncpg` (async); Alembic migrations use `psycopg` (sync).
- **Coordinate System**: WGS-84 (SRID 4326) for all geometry objects.

---

## 2. Table Specifications

### 2.1 `data_source`
Represents a named, citable origin of data imported into blr.life (e.g. OpenStreetMap Karnataka, BMRCL, curated baseline).

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | No | Auto-increment | Primary Key |
| `key` | `VARCHAR(80)` | No | — | Unique machine-readable key (e.g. `osm_geofabrik_karnataka`) |
| `display_name` | `VARCHAR(200)` | No | — | Human-facing display name |
| `source_url` | `TEXT` | Yes | `NULL` | Source URL or reference document |
| `license_identifier` | `VARCHAR(100)` | Yes | `NULL` | SPDX license tag (e.g. `ODbL-1.0`) |
| `attribution_text` | `TEXT` | Yes | `NULL` | Required legal/attribution text for UI |
| `notes` | `TEXT` | Yes | `NULL` | Operator notes |
| `status` | `source_status` | No | `'active'` | `active` or `deprecated` |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Record creation timestamp |

**Constraints & Indexes**:
- `PRIMARY KEY (id)`
- `UNIQUE (key)`
- `CHECK (length(trim(key)) > 0)`
- `CHECK (length(trim(display_name)) > 0)`

---

### 2.2 `dataset_snapshot`
Represents a concrete import event / pipeline run from a `data_source`.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | No | Auto-increment | Primary Key |
| `data_source_id` | `BIGINT` | No | — | Foreign Key -> `data_source.id` (`RESTRICT`) |
| `source_version` | `VARCHAR(100)` | Yes | `NULL` | Upstream version/date string (e.g. `2025-08-01`) |
| `retrieved_at` | `TIMESTAMPTZ` | No | — | Timestamp data was retrieved |
| `content_checksum` | `VARCHAR(128)` | Yes | `NULL` | SHA-256 / MD5 checksum |
| `status` | `snapshot_status` | No | `'pending'` | `pending`, `completed`, `failed`, `partial` |
| `notes` | `TEXT` | Yes | `NULL` | Import run notes |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Record creation timestamp |
| `is_current` | `BOOLEAN` | No | `false` | True if snapshot is active baseline |

**Constraints & Indexes**:
- `PRIMARY KEY (id)`
- `FOREIGN KEY (data_source_id) REFERENCES data_source(id) ON DELETE RESTRICT`
- `INDEX ix_dataset_snapshot_data_source_id (data_source_id)`

---

### 2.3 `locality`
Canonical Bengaluru neighbourhood entities (e.g., HSR Layout, Koramangala, Indiranagar).

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | No | Auto-increment | Primary Key |
| `name` | `VARCHAR(200)` | No | — | Canonical display name |
| `slug` | `VARCHAR(200)` | No | — | URL-safe lowercase slug (e.g. `hsr-layout`) |
| `parent_zone` | `VARCHAR(100)` | Yes | `NULL` | Optional region (e.g. `South Bengaluru`) |
| `is_active` | `BOOLEAN` | No | `true` | UI visibility flag |
| `geometry` | `GEOMETRY(MULTIPOLYGON, 4326)` | Yes | `NULL` | Locality boundary polygon/multipolygon |
| `centroid` | `GEOMETRY(POINT, 4326)` | No | — | Authoritative point centroid |
| `geometry_source` | `geometry_source` | Yes | `NULL` | `osm_polygon`, `osm_point`, `manual_curation`, `centroid_buffer` |
| `geometry_confidence` | `geometry_confidence` | Yes | `NULL` | `high`, `medium`, `low`, `insufficient` |
| `external_source_id` | `VARCHAR(100)` | Yes | `NULL` | Upstream feature ID (e.g. OSM Relation ID) |
| `geometry_snapshot_id` | `BIGINT` | Yes | `NULL` | FK -> `dataset_snapshot.id` (`SET NULL`) |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `now()` | Record update timestamp |

**Constraints & Indexes**:
- `PRIMARY KEY (id)`
- `UNIQUE (slug)`
- `CHECK (length(trim(name)) > 0)`
- `CHECK (length(trim(slug)) > 0)`
- `CHECK (slug = lower(slug))`
- `GIST INDEX ix_locality_geometry (geometry)`
- `GIST INDEX ix_locality_centroid (centroid)`
- `INDEX ix_locality_is_active (is_active)`
- `INDEX ix_locality_geometry_snapshot_id (geometry_snapshot_id)`

---

### 2.4 `locality_alias`
Search synonyms, colloquial names, and abbreviations for localities.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | No | Auto-increment | Primary Key |
| `locality_id` | `BIGINT` | No | — | FK -> `locality.id` (`CASCADE`) |
| `alias` | `VARCHAR(200)` | No | — | Display alias (e.g. `BTM`) |
| `alias_lower` | `VARCHAR(200)` | No | — | Lowercase normalized alias for matching (e.g. `btm`) |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Record creation timestamp |

**Constraints & Indexes**:
- `PRIMARY KEY (id)`
- `UNIQUE (alias_lower)`
- `FOREIGN KEY (locality_id) REFERENCES locality(id) ON DELETE CASCADE`
- `CHECK (length(trim(alias)) > 0)`
- `CHECK (alias_lower = lower(alias_lower))`
- `INDEX ix_locality_alias_alias_lower (alias_lower)`

---

### 2.5 `locality_rent_observation`
Rent band observations for residential housing in a locality.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | No | Auto-increment | Primary Key |
| `locality_id` | `BIGINT` | No | — | FK -> `locality.id` (`CASCADE`) |
| `housing_config` | `housing_configuration` | No | — | `1rk`, `1bhk`, `2bhk`, `3bhk` |
| `rent_min_inr` | `INTEGER` | Yes | `NULL` | Min rent in INR |
| `rent_max_inr` | `INTEGER` | Yes | `NULL` | Max rent in INR |
| `currency_code` | `VARCHAR(3)` | No | `'INR'` | ISO Currency Code |
| `observed_on` | `TIMESTAMPTZ` | Yes | `NULL` | Date of observation |
| `snapshot_id` | `BIGINT` | Yes | `NULL` | FK -> `dataset_snapshot.id` (`SET NULL`) |
| `confidence` | `metric_confidence` | No | — | `high`, `medium`, `low`, `insufficient` |
| `sample_size` | `INTEGER` | Yes | `NULL` | Number of listings sampled |
| `notes` | `TEXT` | Yes | `NULL` | Observational notes |
| `is_current` | `BOOLEAN` | No | `true` | Active preference flag |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Record creation timestamp |

**Constraints & Indexes**:
- `PRIMARY KEY (id)`
- `FOREIGN KEY (locality_id) REFERENCES locality(id) ON DELETE CASCADE`
- `FOREIGN KEY (snapshot_id) REFERENCES dataset_snapshot(id) ON DELETE SET NULL`
- `CHECK (rent_min_inr >= 0)`
- `CHECK (rent_max_inr >= 0)`
- `CHECK (rent_min_inr IS NOT NULL OR rent_max_inr IS NOT NULL)`
- `CHECK (rent_min_inr IS NULL OR rent_max_inr IS NULL OR rent_min_inr <= rent_max_inr)`
- `CHECK (sample_size IS NULL OR sample_size > 0)`
- `CHECK (length(trim(currency_code)) = 3)`
- `INDEX ix_locality_rent_observation_locality_id (locality_id)`
- `INDEX ix_locality_rent_observation_locality_id_housing_config (locality_id, housing_config)`
- `INDEX ix_locality_rent_observation_snapshot_id (snapshot_id)`

---

### 2.6 `locality_metric`
Derived offline metrics (e.g. amenity densities, metro distance) per locality.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | No | Auto-increment | Primary Key |
| `locality_id` | `BIGINT` | No | — | FK -> `locality.id` (`CASCADE`) |
| `metric_type` | `metric_type` | No | — | Predefined metric key |
| `value` | `NUMERIC(12, 4)` | No | — | Fixed-precision metric value |
| `unit` | `VARCHAR(40)` | Yes | `NULL` | Unit string (e.g. `count/km2`, `metres`) |
| `calc_version` | `VARCHAR(80)` | No | — | Version string (e.g. `cafe-density-v1`) |
| `calculated_at` | `TIMESTAMPTZ` | No | — | Calculation timestamp |
| `snapshot_id` | `BIGINT` | Yes | `NULL` | FK -> `dataset_snapshot.id` (`SET NULL`) |
| `confidence` | `metric_confidence` | No | — | `high`, `medium`, `low`, `insufficient` |
| `is_current` | `BOOLEAN` | No | `true` | Active metric flag |
| `created_at` | `TIMESTAMPTZ` | No | `now()` | Record creation timestamp |

**Constraints & Indexes**:
- `PRIMARY KEY (id)`
- `FOREIGN KEY (locality_id) REFERENCES locality(id) ON DELETE CASCADE`
- `FOREIGN KEY (snapshot_id) REFERENCES dataset_snapshot(id) ON DELETE SET NULL`
- `UNIQUE (locality_id, metric_type, calc_version, snapshot_id)`
- `CHECK (length(trim(calc_version)) > 0)`
- `INDEX ix_locality_metric_locality_id (locality_id)`
- `INDEX ix_locality_metric_locality_id_metric_type (locality_id, metric_type)`
- `INDEX ix_locality_metric_snapshot_id (snapshot_id)`

---

## 3. PostgreSQL Enums

The database defines 7 custom ENUM types:
1. `source_status`: `'active'`, `'deprecated'`
2. `snapshot_status`: `'pending'`, `'completed'`, `'failed'`, `'partial'`
3. `geometry_source`: `'osm_polygon'`, `'osm_point'`, `'manual_curation'`, `'centroid_buffer'`
4. `geometry_confidence`: `'high'`, `'medium'`, `'low'`, `'insufficient'`
5. `housing_configuration`: `'rk_1'`, `'bhk_1'`, `'bhk_2'`, `'bhk_3'`
6. `metric_confidence`: `'high'`, `'medium'`, `'low'`, `'insufficient'`
7. `metric_type`: `'cafe_density'`, `'restaurant_density'`, `'park_accessibility'`, `'healthcare_accessibility'`, `'metro_distance_m'`, `'metro_walk_distance_m'`, `'amenity_composite'`
