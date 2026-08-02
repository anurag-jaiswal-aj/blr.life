# Data Source Evaluation

This document contains the detailed source-by-source research for blr.life V1.

## 1. OpenStreetMap (OSM)
- **Official Name**: OpenStreetMap
- **Official URL**: https://www.openstreetmap.org / https://wiki.openstreetmap.org
- **Data Provided**: Geographic boundaries, roads, amenities (restaurants, parks, hospitals, cafes), centroids.
- **Geographic Coverage**: Global, including strong but variable coverage of Bengaluru.
- **Relevant Fields**: Polygons, points, `amenity=*`, `name=*`, `highway=*`.
- **Access Mechanism**: Overpass API for queries, Geofabrik regional extracts for bulk processing.
- **Format**: XML, JSON, PBF.
- **Freshness**: Highly updated by community.
- **License**: Open Data Commons Open Database License (ODbL).
- **Attribution**: Requires "© OpenStreetMap contributors" and adherence to share-alike for derived databases.
- **Operational Risks**: Public Overpass API has rate limits and is not suitable for live production queries. Geofabrik extracts are better for offline ingestion. Not all localities have perfect polygon boundaries (e.g., road corridors lack them entirely).
- **V1 Suitability**: **USABLE WITH CAVEATS**. OSM is suitable for amenities and baseline road networks, provided data is processed offline.

## 2. BBMP Ward Boundaries
- **Official Name**: Bruhat Bengaluru Mahanagara Palike (BBMP) Wards
- **Official URL**: https://opencity.in/ (Community archive of government data)
- **Data Provided**: Administrative ward boundaries.
- **Geographic Coverage**: Bengaluru city limits.
- **Relevant Fields**: Ward Name, Ward No, Polygon.
- **Access Mechanism**: Static GeoJSON/Shapefile downloads.
- **Format**: GeoJSON.
- **License**: Open Data / Government Data.
- **Attribution**: BBMP / OpenCity.in.
- **Operational Risks**: Users search for colloquial locality names (e.g., "Koramangala"), not ward numbers. Wards often group dissimilar areas or divide cohesive neighbourhoods.
- **V1 Suitability**: **UNSUITABLE** as the primary user-facing area model, but potentially useful as a fallback boundary if no OSM polygon exists.

## 3. Bengaluru Namma Metro (BMRCL)
- **Official Name**: Bangalore Metro Rail Corporation Limited
- **Official URL**: https://data.opencity.in/ (Community mirror of government data) / Transport Data Hub (TDH)
- **Data Provided**: Metro stations, lines.
- **Access Mechanism**: 
  - **Authoritative**: IUDX / Open Data Portal APIs (often unstable or hard to access).
  - **Community**: GitHub repos (e.g., geohacker/namma-metro) which provide static GeoJSON.
- **Format**: GeoJSON / CSV.
- **License**: Government Open Data (Official); CC-BY / ODbL (Community). **LICENSE REQUIRES VALIDATION** for exact terms of commercial reuse of official API.
- **V1 Suitability**: **USABLE WITH CAVEATS**. We will use static community-cleaned GeoJSON for V1, acknowledging it is not the real-time authoritative feed.

## 4. BMTC / Public Transport (GTFS)
- **Official Name**: Bangalore Metropolitan Transport Corporation
- **Official URL**: Transport Data Hub (TDH) - tdh.dult-karnataka.com
- **Data Provided**: Official GTFS static datasets (routes, stops, schedules).
- **Access Mechanism**: Downloadable GTFS zip via DULT portal.
- **License**: Government Open Data (requires registration/terms acceptance).
- **V1 Suitability**: **OUT OF SCOPE**. Processing full GTFS requires dedicated routing engines (like OpenTripPlanner) which exceed V1's zero-cost infrastructure limits. We will use nearest Metro station as a proxy instead.

## 5. Routing Engines (OSRM / GraphHopper)
- **Official Name**: Open Source Routing Machine (OSRM)
- **Official URL**: https://project-osrm.org/
- **Data Provided**: Distance matrix, traffic-free driving duration.
- **Access Mechanism**: Self-hosted Docker containers using OSM PBF data.
- **License**: MIT.
- **Operational Risks**: **SEVERE MEMORY COST**. OSRM requires ~1-2GB RAM just to load the Karnataka PBF. It cannot run on a free-tier 1GB VPS alongside the database and application. It does **NOT** provide real-time traffic.
- **V1 Suitability**: **UNSUITABLE FOR ZERO-COST DEPLOYMENT**. V1 will instead use PostGIS `ST_Distance` combined with a manually calibrated Bengaluru traffic heuristic (e.g., 20 km/h peak average) for basic commute approximation to keep costs at ₹0.

## 6. Rent Data Platforms (Real Estate Portals)
- **Candidate Sources**: Property listing sites (MagicBricks, NoBroker, Housing.com).
- **Access Mechanism**: Web scraping.
- **License**: Terms of Service explicitly forbid automated scraping for commercial use.
- **Operational Risks**: High risk of IP bans and legal Cease & Desist. Unreliable listing validity.
- **V1 Suitability**: **UNSUITABLE** (Violates ToS).

## 7. Rent Data Evidence
- **Candidate Sources**: 
  - *MakeMyStay.ai PG Index*: PG/Coliving rent bands (Whitefield, HSR).
  - *Ghosla / BHK Scanner*: Community/live trackers.
  - *bengaluru.rent*: User-pinned rent map.
- **Access Mechanism**: Manual transcription of reports and public index dashboards.
- **License**: **LICENSE REQUIRES VALIDATION**. Extracting bulk data from these trackers might violate their terms, so only aggregated, manually transcribed broad bands (e.g., "HSR 1BHK: ₹18k-25k") can be used.
- **Operational Risks**: Aggregated data is coarse and quickly becomes stale.
- **V1 Suitability**: **USABLE WITH CAVEATS**. V1 will use manually curated, coarse affordability categories (e.g., $, $$, $$$) or extremely broad rent ranges explicitly marked as low-confidence/experimental.

## 8. Nominatim / Geocoding
- **Official Name**: Nominatim / Photon
- **Data Provided**: Geocoding (Text to Coordinates).
- **Access Mechanism**: HTTP API (Nominatim) or Self-hosted (Photon).
- **License**: ODbL (OSM data). Photon software is Apache 2.0.
- **Operational Risks**: Public Nominatim forbids bulk usage (1 req/sec limit). Self-hosting Photon requires Elasticsearch and ~2GB+ RAM, breaking the zero-cost requirement.
- **V1 Suitability**: **USABLE WITH CAVEATS**. V1 will use a small curated list of major employment hubs (e.g., "Manyata Tech Park", "Embassy Tech Village") as drop-down selections, falling back to an interactive map-click (manual pin) for arbitrary locations. This avoids geocoding API costs entirely.

## 9. MapLibre & Map Tiles
- **Official Name**: MapLibre GL JS (Library) + Tile Providers
- **Data Provided**: Client-side vector map rendering and tiles.
- **License**: MapLibre (BSD 3-Clause). 
- **Operational Risks**: Using OSM's default public tile servers for a commercial app violates their policy.
- **Tile Options**:
  - *MapTiler Cloud*: Free tier allows 100k requests/month for non-commercial use only.
  - *Stadia Maps*: Free tier allows 200k requests/month (commercial allowed without support).
  - *Protomaps PMTiles*: Free to self-host, but requires storage and bandwidth on the VPS.
- **V1 Suitability**: **USABLE**. V1 will use MapLibre GL JS with Stadia Maps free tier for the public beta to minimize hosting costs while complying with licenses.
