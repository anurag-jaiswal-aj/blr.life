# Bengaluru Canonical Locality Registry

This document outlines the policy and coverage of the canonical Bengaluru locality registry used in `blr.life`. 
For V1, accuracy is more important than absolute coverage quantity, so we focus on ~36 canonical localities representing major residential and employment hubs.

## Purpose

The registry establishes the PRODUCT-LEVEL canonical identity for localities. Users think in terms of these well-known names (e.g., "HSR Layout", "Koramangala"), not in arbitrary administrative boundaries. This registry determines *which* areas `blr.life` supports.

## Selection Criteria

Localities are included if they are:
1. Commonly recognized by Bengaluru residents.
2. Useful as a housing decision unit.
3. Distinguishable from neighboring canonical localities.

Granular blocks (e.g., Koramangala 4th Block, HSR Sector 2) are intentionally excluded unless a specific area becomes a distinct real estate market on its own.

## Canonical Naming and Slugs

- **Canonical Name**: Normal Bengaluru usage (e.g., `HSR Layout`, `Koramangala`).
- **Slug**: Deterministic lowercase kebab-case (e.g., `hsr-layout`, `koramangala`).

## Alias Policy

Aliases are included only when genuinely useful (e.g., `E-City` for Electronic City, `BSK` for Banashankari). We do not manufacture capitalization variants; the ingestion pipeline normalizes these automatically.

## Ambiguity and Corridors Policy

- **Ambiguous Names**: E.g. "BTM" vs "BTM Layout" — BTM Layout is canonical, BTM is an alias. "Electronic City" is canonical, "Electronics City" is an alias.
- **Corridors**: "Sarjapur Road", "Bannerghatta Road", and "Outer Ring Road (ORR)" are corridors, not polygonal localities. They are **DEFERRED** for V1 or will be represented in a different geographic structure later.
- **Tech Parks**: "Manyata Tech Park" is an employment hub, not a residential locality. Housing searches typically target the surrounding area, e.g., "Nagavara".

## Provenance and Identity

The real V1 curated registry is stored at `data/curated/bengaluru_localities_v1.json`. It is explicitly ingested with:
- `data_source`: `blr_life_curated_locality_registry`
- `source_version`: `v1`

Data updates rely on exact version matching and SHA-256 payload checksumming for idempotency and conflict detection.

## Geometry Readiness

All V1 curated localities currently have their `centroid` properly verified against **Nominatim OpenStreetMap**. They have a geometry source of `osm_polygon` or `osm_point` and `medium` confidence.
Full OSM polygon boundary matching is DEFERRED to a future work unit.

## V1 Locality Coverage (37 Localities)

| Canonical Name | Slug | Aliases |
|---|---|---|
| HSR Layout | `hsr-layout` | HSR |
| Koramangala | `koramangala` | |
| Indiranagar | `indiranagar` | |
| Whitefield | `whitefield` | |
| BTM Layout | `btm-layout` | BTM |
| Electronic City | `electronic-city` | E-City, Electronics City |
| Jayanagar | `jayanagar` | |
| JP Nagar | `jp-nagar` | |
| Malleshwaram | `malleshwaram` | Malleswaram |
| Rajajinagar | `rajajinagar` | |
| Hebbal | `hebbal` | |
| Yelahanka | `yelahanka` | Yelahanka New Town |
| Bellandur | `bellandur` | Bellanduru |
| Marathahalli | `marathahalli` | |
| Mahadevapura | `mahadevapura` | |
| CV Raman Nagar | `cv-raman-nagar` | |
| Basavanagudi | `basavanagudi` | |
| Banashankari | `banashankari` | BSK |
| Kalyan Nagar | `kalyan-nagar` | |
| Kammanahalli | `kammanahalli` | |
| KR Puram | `kr-puram` | Krishnarajapuram |
| RR Nagar | `rr-nagar` | Rajarajeshwari Nagar |
| Kengeri | `kengeri` | Kengeri Satellite Town |
| Vijayanagar | `vijayanagar` | |
| Yeshwanthpur | `yeshwanthpur` | Yeshwantpur |
| Richmond Town | `richmond-town` | |
| Vasanth Nagar | `vasanth-nagar` | |
| Sadashivanagar | `sadashivanagar` | |
| Shanthi Nagar | `shanthi-nagar` | |
| Nagavara | `nagavara` | |
| Sahakara Nagar | `sahakara-nagar` | |
| Jakkur | `jakkur` | |
| Hennur | `hennur` | |
| Banaswadi | `banaswadi` | |
| Brookefield | `brookefield` | |
| Kadubeesanahalli | `kadubeesanahalli` | |
| Domlur | `domlur` | |

## Update/Review Process

Changes to the registry JSON file must be committed via Git. Any structural changes or addition of localities will require updating the dataset payload and validating via the ingestion pipeline (`make validate-localities`).

## Data Attribution
Geographic coordinates derived from OSM are OSM-derived data. 
Nominatim is merely a search interface over OSM data, not an authoritative Bengaluru locality registry.
Data is provided under the ODbL license. © OpenStreetMap contributors.
