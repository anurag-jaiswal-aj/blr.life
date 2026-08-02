# Data Strategy

V1 relies entirely on deterministic data. We must acquire, normalize, and store this data without relying on paid APIs or fake generation.

## Data Categories

### 1. Bengaluru Neighbourhood Boundaries (Areas)
- **Why**: To know where an area is, calculate distances, and display on a map.
- **Source**: OpenStreetMap (OSM) administrative boundaries, or manual GeoJSON curation.
- **Free/Open**: Yes (OSM).
- **Confidence**: High, though unofficial borders can be fuzzy.
- **REQUIRES DATA VALIDATION**: Need to verify if OSM has distinct boundaries for areas like "HSR Layout Sector 1" vs just "HSR Layout".

### 2. Rent Estimates
- **Why**: To filter out unaffordable areas.
- **Source**: Web scraping (NoBroker/Housing.com public aggregated data - if legal), manual curation of baseline averages, or crowdsourced data.
- **Free/Open**: Tricky. 
- **Confidence**: Medium. Rent fluctuates.
- **Fallback**: Use wide rent bands (e.g., "Budget: ₹15k - ₹25k") and map areas to bands rather than exact figures.
- **REQUIRES DATA VALIDATION**: We must establish a legal, viable baseline rent dataset for the top 50 areas.

### 3. Commute & Routing (Distance)
- **Why**: To score areas based on proximity to the user's workplace.
- **Source**: PostGIS straight-line distance (haversine/geography) with a "Bengaluru Traffic Penalty Heuristic", OR an open routing engine like OSRM (Open Source Routing Machine).
- **Free/Open**: Yes.
- **Confidence**: Medium. Traffic varies wildly.
- **Strategy**: V1 will use spatial distance adjusted by heuristic speeds, explicitly warning users that times are estimates.

### 4. Metro Accessibility
- **Why**: A major lifestyle and commute preference.
- **Source**: Namma Metro station coordinates (OSM or manual entry).
- **Free/Open**: Yes.
- **Confidence**: High.

### 5. Amenities & Lifestyle Indicators (Cafes, Parks, Hospitals)
- **Why**: To score preferences like "Nightlife", "Quietness", "Healthcare".
- **Source**: OSM POI (Points of Interest) data (Overpass API).
- **Free/Open**: Yes.
- **Confidence**: High for quantity, medium for quality.
- **Strategy**: Calculate density (e.g., cafes per square km) and normalize it to a 0-100 score for each area.

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
