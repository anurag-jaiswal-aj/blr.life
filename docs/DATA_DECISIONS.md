# Data Decisions

This document records the major architectural and domain decisions regarding data sourcing and geographic modeling for blr.life V1.

---

### Decision: Primary Neighbourhood Model
**Status**: Approved
**Evidence**: Users search for colloquial names (e.g., "Koramangala"), not administrative divisions (e.g., "Ward 173"). Administrative boundaries often split natural neighbourhoods or combine disparate ones.
**Chosen approach**: The primary geographic unit is the "Colloquial Locality" mapped to an OSM `place=suburb` or `place=neighbourhood` polygon (or a centroid buffer as fallback).
**Rejected alternatives**: Using BBMP Ward boundaries. 
**Risks**: OSM polygons can be imperfect, disputed, or missing.
**Revisit trigger**: If user feedback consistently indicates that amenity counts are wrong due to boundary inaccuracies.

---

### Decision: Amenity Data Sourcing
**Status**: Approved
**Evidence**: OSM provides the most comprehensive, zero-cost dataset for restaurants, cafes, hospitals, and parks in Bengaluru. The public Overpass API restricts bulk scraping and real-time production queries.
**Chosen approach**: Download static OSM PBF regional extracts and process them offline into the local PostGIS database using a CLI pipeline.
**Rejected alternatives**: Querying Overpass API in real-time (banned for high traffic); Using Google Places API (too expensive).
**Risks**: OSM data can be incomplete or outdated compared to commercial APIs.
**Revisit trigger**: If amenity coverage in top 50 localities is found to be unacceptably sparse during manual validation.

---

### Decision: Rent Data Strategy
**Status**: Approved
**Evidence**: Scraping real estate portals (MagicBricks, NoBroker) violates their Terms of Service. Open datasets on Kaggle are often stale.
**Chosen approach**: Launch with a manually curated, static baseline of rent bands (e.g., 1BHK, 2BHK) for the top ~50 localities, sourced by aggregating market reports and community insights, marked with low confidence.
**Rejected alternatives**: Automated scraping of portals; Removing the budget filter entirely.
**Risks**: Rents change dynamically, and static bands may frustrate users if they do not match current market reality.
**Revisit trigger**: Post-launch, evaluate implementing a crowdsourced "pin your rent" feature to gather proprietary, first-party data.

---

### Decision: Routing and Commute Calculations
**Status**: Approved
**Evidence**: Google Maps Directions API is cost-prohibitive for V1. Open source routers (OSRM, GraphHopper) provide excellent distance and traffic-free duration but lack real-time traffic data without paid integrations.
**Chosen approach**: Self-host OSRM using OSM data. Rank recommendations based on driving distance and traffic-free duration, transparently communicating to the user that real-time traffic is not included.
**Rejected alternatives**: Straight-line PostGIS distance only (too inaccurate); Paid Maps API.
**Risks**: OSRM requires significant server memory. Traffic-free duration in Bengaluru is a poor proxy for actual commute time during peak hours.
**Revisit trigger**: If users complain that recommendations suggest impossibly long peak-hour commutes despite short distances.

---

### Decision: Initial Geographic Coverage
**Status**: Approved
**Evidence**: Attempting to launch with all of Bengaluru's hundreds of micro-localities will dilute data quality and overwhelm manual validation efforts.
**Chosen approach**: Launch with a curated seed list of 30-50 high-demand residential and employment hubs.
**Rejected alternatives**: Launching with city-wide automated ingestion of every OSM place node.
**Risks**: Excluding a user's preferred niche neighbourhood might cause them to bounce.
**Revisit trigger**: Once the core engine is proven, scale ingestion to the rest of the city automatically.

---

## Schema Readiness Recommendation

READY FOR DOMAIN SCHEMA IMPLEMENTATION
