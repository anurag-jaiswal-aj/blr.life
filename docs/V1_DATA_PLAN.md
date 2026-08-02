# V1 Data Plan

This document outlines the actionable data plan for blr.life V1, detailing what data we will use, what we will avoid, and how we will maintain it.

## 1. What Data V1 WILL Use
- **Geographic Boundaries & Centroids**: Sourced from OpenStreetMap (OSM) via Geofabrik regional extracts.
- **Amenities (Restaurants, Cafes, Parks, Hospitals)**: Sourced from OSM (offline ingestion).
- **Metro Stations**: Static station coordinates from official BMRCL open data or validated community datasets.
- **Commute/Routing**: Distance matrix via PostGIS `ST_Distance` combined with a manually calibrated Bengaluru traffic heuristic (e.g. 20 km/h average speed), acknowledging that self-hosting OSRM exceeds our ₹0 hosting budget.
- **Rent Baselines**: Coarse affordability categories ($, $$, $$$) and extremely broad, low-confidence ranges transcribed from market reports and trackers.
- **Geocoding**: A small curated list of major employment hubs for drop-down selection, falling back to a manual map pin click. Self-hosting Photon exceeds our ₹0 memory budget.
- **Map Rendering**: MapLibre GL JS with Stadia Maps free tier (up to 200k req/mo).

## 2. What Data V1 Will NOT Use
- **Real-Time Traffic**: Too expensive/complex for V1 without paid Google Maps APIs.
- **Live Rent Listings**: No scraping of property portals (violates ToS).
- **Full Public Transit Routing (GTFS)**: Too complex for a V1 timeline; we will use nearest Metro station distance as a proxy for transit connectivity instead of calculating exact multi-modal transit times.
- **Public API Dependency for Core Logic**: We will not rely on live calls to Nominatim or Overpass API due to rate limits.

## 3. Data Acquisition & Validation
- **Acquisition**: A CLI-driven offline ingestion pipeline. We will download the `karnataka-latest.osm.pbf` extract from Geofabrik and process it locally to seed PostgreSQL/PostGIS.
- **Validation**:
  - **Automated**: Ensure coordinates fall within a bounding box of Bengaluru.
  - **Manual Curation**: The top 30-50 high-demand localities will be manually verified.

## 4. OSM Production Architecture
To avoid relying on live Overpass API queries, the data flow will be:
`Geofabrik PBF (Raw file outside Git) → Validation/transformation CLI → Canonical PostGIS Tables (Amenities, Geometry) → Derived area metrics → Recommendation engine API`. 
We will strictly import ONLY localities and amenities. We will NOT import the entire road network since we are using PostGIS distance heuristics instead of a full routing engine.

## 4. Attribution
- **OSM**: "© OpenStreetMap contributors" displayed on the map and footer, complying with ODbL.
- **Metro**: BMRCL attribution where applicable.

## 5. Refresh Cadence
- **Boundaries & Geometries**: Static Seed / Manual Refresh (quarterly).
- **Amenities**: Periodic Refresh via CLI pipeline (monthly).
- **Rent Baselines**: Manual Refresh (quarterly/biannually) based on market reports.
- **Metro Network**: Manual Refresh (only upon new line inaugurations).

## 6. Confidence Level & Fallback Behavior
- **Confidence Model**: Metrics will carry a `HIGH`, `MEDIUM`, or `LOW` confidence score.
  - *High*: Confirmed static data (e.g., distance, metro stations).
  - *Medium*: OSM amenity density (subject to mapping completeness).
  - *Low*: Rent bands (approximate baselines).
- **Fallback**: If an OSM locality polygon is missing or it is a road-corridor (e.g., Sarjapur Road), we will use a manually curated GeoJSON boundary.

## 7. Provenance Implementation Requirements
We need to answer: *Which dataset produced this metric? When was it imported? What confidence does it have?*
For V1, we need minimal schema concepts:
- **DataSource**: Enum (e.g., `OSM_GEOFABRIK_KARNATAKA`, `MANUAL_CURATION`, `BMRCL_COMMUNITY_GEOJSON`).
- **MetricObservation**: A record of a calculated metric (e.g., `cafe_density`) linked to its DataSource, an `observed_at` timestamp, and a `confidence` level.
Concepts like `DatasetSnapshot` or `ImportRun` can wait for V2.

## 8. Dataset Repository Policy
- **COMMIT**: Small manually reviewed locality registry, aliases, curated Metro station registry, coarse rent bands. (These are core domain seeds).
- **DOWNLOAD/DO NOT COMMIT**: Raw `karnataka-latest.osm.pbf` (Too large).
- **GENERATE**: Derived area metrics (Calculated by the app).

## 9. Zero-Cost Deployment Reality
blr.life V1 must be realistically deployable at near-zero cost (e.g., AWS t2.micro or similar 1GB RAM free tier).
- **FastAPI + Next.js + PostgreSQL/PostGIS**: Can comfortably run on 1GB RAM if optimized.
- **Photon Geocoding**: Requires Elasticsearch and ~2GB+ RAM. **Cannot self-host for ₹0**. We must use a curated dropdown + manual map pin instead.
- **OSRM Routing**: Requires ~1-2GB RAM just to load Karnataka. **Cannot self-host for ₹0**. We must use PostGIS `ST_Distance` heuristics instead.

## 10. Proposed Initial Coverage
- **Launch Scope**: Launch with a manually curated seed list of ~30-50 high-demand employment and residential hubs (e.g., HSR, Koramangala, Indiranagar, Whitefield, Bellandur, Electronic City, Malleshwaram).
- **Strategy**: Focus on depth and accuracy in top areas rather than unverified city-wide breadth.

---

## Feasibility Matrix

| Data Need | Candidate Source | Verified? | License Clear? | Quality | V1 Decision | Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Neighbourhood names | OSM / Curated List | VERIFIED | Yes (ODbL) | High | Curated Static List | None |
| Neighbourhood boundaries | OSM Polygons | VERIFIED | Yes (ODbL) | Variable | OSM Polygons | Curated GeoJSON |
| Centroids | OSM | VERIFIED | Yes (ODbL) | High | OSM Points | Geocoding service |
| Amenities | OSM (Geofabrik) | VERIFIED | Yes (ODbL) | Medium | Offline PBF Ingestion | None |
| Metro stations | Community GeoJSON | USABLE WITH CAVEATS | Yes (CC-BY/ODbL) | High | Static Seed | None |
| BMTC (Bus) | TDH / IUDX (GTFS) | OUT OF SCOPE | Yes (Open) | N/A | Omit full transit routing | Nearest Metro Proxy |
| Road routing | None (Free limit exceeded)| UNSUITABLE | N/A | N/A | PostGIS `ST_Distance` | Straight-line distance |
| Commute time | None (Free limit exceeded)| UNSUITABLE | N/A | N/A | Heuristic (Dist / 20km/h) | Straight-line heuristic |
| Traffic | None (Free) | UNSUITABLE | N/A | N/A | Omit real-time traffic | Static heuristic |
| Rent | Reports / bengaluru.rent | USABLE WITH CAVEATS| Requires Validation | Low | Coarse Affordability ($) | Omit Rent filter |
| Geocoding | Curated List + Map Pin | VERIFIED | N/A | High | Dropdown + Manual Pin | None |
| Map tiles | MapLibre + Stadia Maps | VERIFIED | Yes (BSD/Terms) | High | Stadia Free Tier | None |

---

## Critical Go / No-Go Answers

1. **Can blr.life V1 provide useful neighbourhood recommendations without paid APIs?**
   **YES**. By relying on PostGIS geographic distance heuristics and offline OSM data for amenities, we can provide strong recommendations without incurring API costs.

2. **Can V1 provide defensible rent-aware recommendations?**
   **YES, WITH LIMITATIONS**. We cannot provide real-time hyper-accurate median rents legally or for free. We must rely on broad, static affordability bands ($, $$, $$$).

3. **Can V1 provide actual traffic-aware commute estimates?**
   **NO**. Open-source routing engines do not include real-time Bengaluru traffic out of the box, and self-hosting them exceeds our ₹0 memory budget anyway.

4. **Can V1 launch without real-time traffic?**
   **YES**. We can use a calibrated heuristic (e.g. geographic distance / average Bengaluru speed) to rank relative commute efficiency.

5. **Can V1 legally/reliably use OSM-derived amenities?**
   **YES**. By downloading a regional extract (`karnataka-latest.osm.pbf`) and processing it offline into our database, we comply with ODbL.

6. **Can V1 obtain adequate neighbourhood geometry?**
   **YES, WITH LIMITATIONS**. OSM has polygons for most major layouts, but missing ones and road-corridors will require manual GeoJSON curation.

7. **What are the three biggest unresolved data risks?**
   - **Rent Accuracy**: Static affordability bands might frustrate users looking for exact budgets.
   - **Commute Inaccuracy**: Distance-based heuristics without road-network routing may suggest physically impossible short commutes (e.g. across a lake).
   - **Colloquial Geometry**: A user's definition of "Sarjapur Road" is highly subjective.
