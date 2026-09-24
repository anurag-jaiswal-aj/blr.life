# Bengaluru Boundary Dataset Evaluation

## 1. Objective
To identify and evaluate real, legally usable geographic boundary datasets that could provide locality/neighbourhood polygons for blr.life, without altering existing semantic distance logic or deploying unverified data.

## 2. Existing 37 Locality Universe
The blr.life platform currently tracks 37 canonical localities across Bengaluru. 
These are defined primarily by `osm_point` (centroid nodes) or `osm_polygon` (relations), indicating that OSM is our current baseline for geographic identification. The 37 localities include planned layouts (e.g., HSR Layout, BTM Layout), traditional neighbourhoods (e.g., Basavanagudi, Malleshwaram), and modern IT corridors (e.g., Whitefield, Electronic City).

## 3. Dataset Candidates

### BBMP Ward Boundaries (2023 Delimitation)
- **Source**: OpenCity.in / BBMP
- **Official URL**: https://data.opencity.in/dataset/bbmp-wards-2023-shapefiles
- **Scope**: 225 electoral wards covering the Bruhat Bengaluru Mahanagara Palike (BBMP) jurisdiction.
- **Format**: GeoJSON, KML, Shapefile
- **License**: CC BY 4.0 / Open Data
- **Attribution**: Required (OpenCity / BBMP)
- **Coverage**: Covers the entire BBMP area.
- **Geometry**: Polygons / MultiPolygons. High quality, officially delimited.
- **37-locality mapping**: Poor conceptual match. Wards are electoral subdivisions created for population parity, not cultural or real-estate neighbourhood boundaries. For example, Jayanagar spans multiple wards, while Koramangala is split across Ejipura and Koramangala wards. Some localities (like Electronic City) partially fall outside older BBMP limits or are split.
- **Quality considerations**: High topological quality, non-overlapping.
- **Cost**: ₹0 (Open source)
- **Legal/use considerations**: Safe for commercial and product use under CC BY 4.0.
- **Classification**: NOT SUITABLE (Conceptual mismatch: Wards do not represent true locality/neighbourhood extents).

### OpenStreetMap (OSM) Neighbourhood / Suburb Boundaries
- **Source**: OpenStreetMap (via Overpass API / MapTiler)
- **Official URL**: https://www.openstreetmap.org/
- **Scope**: Global, crowd-sourced geographic data.
- **Format**: GeoJSON (via Overpass)
- **License**: Open Data Commons Open Database License (ODbL)
- **Attribution**: Required ("© OpenStreetMap contributors")
- **Coverage**: Covers all of Bengaluru, but boundary coverage is patchy.
- **Geometry**: Mixed. Some are robust MultiPolygons (Relations), others are single Polygons, and many are just Points (Nodes).
- **37-locality mapping**: Excellent conceptual match (tags like `place=suburb` or `place=neighbourhood`), but incomplete. As per our internal `bengaluru_localities_v1.json`, only ~8 out of 37 localities currently have relation polygons mapped (e.g., HSR Layout, JP Nagar, Bellandur), while the rest are only nodes.
- **Quality considerations**: High variance. Polygon intersections, gaps, and self-intersecting geometries are common in crowd-sourced data.
- **Cost**: ₹0 (Open source)
- **Legal/use considerations**: ODbL permits commercial use and database creation, provided attribution is given and derived databases are shared under the same license (Share-Alike).
- **Classification**: POSSIBLY VIABLE — NEEDS VERIFICATION (Requires manual effort to map missing polygons).

### BDA (Bangalore Development Authority) Layout Maps
- **Source**: Bharatlas / OpenCity.in
- **Official URL**: https://data.opencity.in/
- **Scope**: BDA-approved residential and commercial layouts.
- **Format**: KML / GeoJSON
- **License**: Unclear / Varies (indicative surveys)
- **Attribution**: Required
- **Coverage**: Limited only to planned BDA layouts (e.g., HSR, BTM, JP Nagar).
- **Geometry**: Polygons.
- **37-locality mapping**: Incomplete. Misses historical/unplanned areas (e.g., Basavanagudi, parts of Indiranagar) and non-BDA IT hubs (Electronic City, Mahadevapura).
- **Quality considerations**: Digitized from indicative PDFs; precision varies.
- **Cost**: ₹0 (Open source)
- **Legal/use considerations**: LICENSE STATUS: UNCLEAR — DO NOT INGEST YET. Often provided for informational use, lacking explicit commercial open-data licenses from the government.
- **Classification**: NOT SUITABLE (Incomplete coverage and unclear licensing).

## 4. OSM 37-Locality Coverage Verification

A comprehensive verification script was run against the Nominatim OpenStreetMap API to accurately determine the actual polygon coverage for our 37 localities. The results conclusively demonstrate that the prior estimate of ~8 polygons was incorrect, as most of those were actually administrative boundaries (wards) instead of true locality polygons.

**Final Verification Results:**
- **37** total localities evaluated
- **2** `POLYGON_CONFIRMED` (True locality/suburb boundaries)
- **14** `AMBIGUOUS` (Administrative ward boundaries only)
- **21** `POINT_ONLY` (Node markers only, no boundary polygons)
- **0** `NO_MATCH_FOUND`
- **2/37** = approximately **5.4%** confirmed polygon coverage

**Confirmed locality polygons:**
- HSR Layout
- JP Nagar

For the remaining 35 localities, no qualifying locality polygon was identified through the verification methodology. The 14 administrative ward boundaries MUST NOT be treated as usable locality polygons because electoral wards often bisect or combine natural neighbourhoods and do not accurately reflect the colloquial geospatial definitions of these localities.

**OSM locality polygon coverage is insufficient to serve as the V1 boundary source for the 37-locality universe.**

## 5. Geometry Quality Assessment
- **PostGIS MultiPolygon Compatibility**: BBMP Wards and BDA layouts typically offer clean polygons. OSM boundaries can be messy (overlapping geometries, self-intersections) and require PostGIS `ST_MakeValid` upon ingestion.
- **Resolution/Simplification**: Official boundaries might have excessively high vertex counts, requiring `ST_Simplify` to maintain frontend MapLibre rendering performance.
- **Topology**: Neighbourhoods natively overlap in the real world. OSM allows overlapping boundaries, whereas BBMP wards are strictly non-overlapping.

## 6. Licensing and Redistribution Assessment
- **CC BY 4.0 (OpenCity / DataMeet)**: Allows commercial use. Attribution required.
- **ODbL (OSM)**: Allows commercial use but triggers Share-Alike provisions if we mix/derive new datasets and distribute them. Storing and displaying OSM polygons for our 37 localities is generally safe, provided we attribute OSM.
- **Unclear Licenses**: Datasets without explicit licenses must be avoided to prevent intellectual property risks for blr.life.

## 7. Coverage Gaps
The most significant gap is the lack of digitized polygons for major localities in OSM (e.g., Koramangala, Indiranagar, Whitefield, Electronic City). Relying solely on existing open data means ~95% of our universe currently lacks a ready-to-use polygon boundary that perfectly matches the colloquial neighbourhood definition.

## 8. Risks and Unknowns
- **Conceptual Mismatch**: Injecting BBMP wards as "localities" will confuse users, as a single neighbourhood like Koramangala spans multiple distinct wards.
- **Data Completeness**: No single open dataset cleanly provides exactly our 37 canonical localities as polygons.
- **ODbL Share-Alike**: We must ensure that simply using OSM polygons in our PostgreSQL database and serving them via API does not force our proprietary recommendation data to become open under ODbL provisions (typically safe if kept as a separate layer).

## 9. Conclusion
- **Technically Plausible but Practically Insufficient**: **OpenStreetMap (OSM)** is the only dataset that conceptually aligns with colloquial neighbourhood boundaries (unlike electoral wards). However, OSM locality polygon coverage is insufficient to serve as the V1 boundary source for the 37-locality universe.
- **Action Item**: Do not ingest external boundary datasets into the database at this time. The application will continue to operate via node/point-based geographic logic until a more complete and accurate boundary dataset is either procured or manually generated.
