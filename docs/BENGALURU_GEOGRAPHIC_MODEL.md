# Bengaluru Geographic Model

This document defines the conceptual geographic model for blr.life V1. This does not represent specific SQLAlchemy tables or migrations, but rather the domain logic guiding how we represent Bengaluru's geography to users.

## 1. Locality (The Core Concept)
- **Concept**: The primary unit of geography in blr.life is the **Colloquial Locality** (e.g., "Koramangala", "HSR Layout", "Indiranagar").
- **Rationale**: Users search for and think in terms of these well-known neighbourhood names, not in terms of administrative boundaries like "BBMP Ward 173".
- **Identifier**: A canonical, human-readable string ID (e.g., `koramangala`).
- **Display Name**: The formatted, standard name presented in the UI (e.g., "Koramangala").

## 2. Geometry
- **Primary Geometry**: A PostGIS `POLYGON` or `MULTIPOLYGON`.
- **Source**: Ideally derived from OpenStreetMap boundaries where the `place=suburb` or `place=neighbourhood` tag provides a well-defined area.
- **Usage**: Used for spatial joins (e.g., counting the number of restaurants strictly inside the locality) and rendering boundaries on the UI map.

## 3. Centroid
- **Concept**: A PostGIS `POINT` representing the geographic center of the locality.
- **Derivation**: 
  - If a precise geometry polygon exists, the centroid is mathematically calculated (`ST_Centroid`).
  - If only a point node exists in OSM (e.g., an area mapped only as a point), this point serves directly as the centroid.
- **Usage**: Used for distance-based commute calculations (e.g., distance from workplace to Locality Centroid) and radius-based amenity searches (e.g., hospitals within 2km).

## 4. Fallback Geometry
- **Concept**: Not all colloquial localities have perfectly mapped polygons in OSM.
- **Strategy**:
  - **Tier 1 (Optimal)**: OSM Polygon exists and maps well to the colloquial definition.
  - **Tier 2 (Curated Fallback)**: For missing polygons, ambiguous points, or road-corridors (e.g., Sarjapur Road), V1 will use a manually curated GeoJSON boundary. A fixed radius (like 1.5km) is rejected because locality extents vary wildly in Bengaluru.
  - **Tier 3 (Centroid Radius)**: If curation is pending, use a variable radius assigned per-locality (e.g., 500m for a dense inner-city point, 2km for a suburban expansion) rather than a hardcoded global constant.

## 5. Alias
- **Concept**: Alternate names or common misspellings for a locality.
- **Usage**: Crucial for search and geocoding input mapping.
- **Examples**: "Koramangla" -> "Koramangala", "BTM" -> "BTM Layout".

## 6. Parent Geography
- **Concept**: The larger zone or region encompassing the locality.
- **Usage**: Helps in broad filtering or contextualizing areas.
- **Examples**: "South Bengaluru", "East Bengaluru", "Outer Ring Road (ORR)".
- **Implementation**: Likely a static enumeration or self-referential relationship, manually assigned to curated localities.

## 7. Boundary Confidence
- **Concept**: A metric (e.g., `HIGH`, `MEDIUM`, `LOW`) indicating our trust in the geographic precision of this locality.
- **Levels**:
  - **HIGH**: Verified, community-agreed OSM polygon that accurately reflects the colloquial neighbourhood.
  - **MEDIUM**: Synthetic polygon derived from a buffer around a centroid.
  - **LOW**: Disputed area or a proxy boundary (e.g., using a ward boundary that is too large).
- **Impact**: Displayed in the UI so users understand when a boundary is approximate, and factored into the confidence score of area-based amenity metrics.
