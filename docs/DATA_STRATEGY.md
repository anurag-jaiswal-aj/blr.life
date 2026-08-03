# Data Strategy

V1 relies entirely on deterministic data. We must acquire, normalize, and store this data without relying on paid APIs or fake generation.

## Data Categories

### 1. Bengaluru Neighbourhood Boundaries (Areas)
- **Why**: To know where an area is, calculate distances, and display on a map.
- **Source**: OpenStreetMap (OSM) administrative boundaries (polygons).
- **Free/Open**: Yes (OSM ODbL).
- **Confidence**: High for verified polygons, lower for fallback buffers.
- **Status**: V1 will use OSM polygons where available. If missing, V1 will fall back to a 1.5km buffer around the OSM point (centroid).

### 2. Rent Estimates
- **Why**: To filter out unaffordable areas.
- **Source**: Verified curation of broad affordability bands strictly based on published market research (e.g., authoritative Anarock Q3 2024 Residential Market Reports). Web scraping of property portals and aggregator medians (NoBroker, Magicbricks) are strictly prohibited and do not remain in the dataset.
- **Free/Open**: Yes, but requires manual curation.
- **Confidence**: High, based strictly on published research data.
- **Fallback**: Missing data is explicitly omitted rather than hallucinated and fails open: the locality remains eligible and affordability is reported as unknown. The affordability hard filter applies only where verified matching locality/BHK rent data exists, with the filtering boundary being `rent_min_inr <= max_budget_inr`.
- **Status**: V1 features verified rent coverage for only 2 canonical localities (Whitefield, Electronic City). Both observations are 2BHK. Total coverage is 2 / 37 canonical localities (≈ 5.4%). Bengaluru-wide affordability coverage is explicitly NOT claimed.

### 3. Commute & Routing (Distance)
- **Why**: To score areas based on proximity to the user's workplace.
- **Source**: Self-hosted OSRM (Open Source Routing Machine) using offline OSM data.
- **Free/Open**: Yes (MIT license, ODbL data).
- **Confidence**: High for distance, medium for time (lacks real-time traffic).
- **Strategy**: V1 will use OSRM traffic-free duration and driving distance, explicitly warning users that times are estimates and do not account for live traffic.

### 4. Metro Accessibility
- **Why**: A major lifestyle and commute preference.
- **Source**: Namma Metro station coordinates (OSM or manual entry).
- **Free/Open**: Yes.
- **Confidence**: High.

### 5. Amenities & Lifestyle Indicators (Cafes, Parks, Hospitals)
- **Why**: To score preferences like "Nightlife", "Quietness", "Healthcare". *Note: Quietness is currently deferred / unsupported in the V1 implementation.*
- **Source**: OSM POI data ingested offline (via Geofabrik extracts).
- **Free/Open**: Yes (ODbL).
- **Confidence**: High for quantity, medium for quality.
- **Strategy**: Calculate density (e.g., cafes per square km) and normalize it to a 0-100 score for each area, without relying on live Overpass API calls.

## Avoiding Fake Data
**Rule**: If we lack data for a specific metric in a specific area, we do not invent it.
- We set the `confidence_score` for that metric to 0.
- The UI must reflect this (e.g., "Insufficient data for Nightlife score").
- This builds trust. AI hallucination of rent prices or cafe density is strictly prohibited.

## Data Provenance
In the future, the `AreaMetric` table will include:
- `source` (e.g., "OSM", "Manual", "Scrape_v1")
- `sample_size` (e.g., number of listings used to calculate average rent)
This ensures the platform can defend its recommendations.
