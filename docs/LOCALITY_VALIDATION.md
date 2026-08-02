# Locality Validation

This document tests the assumption that OpenStreetMap (OSM) contains usable polygons for major Bengaluru localities.

## Candidate Sample Validation

| Locality (Search Term) | Canonical OSM Name | OSM Object Type | Geometry Available | Classification | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| HSR Layout | HSR Layout | relation / way | Polygon | GOOD | Well-defined boundary, split into sectors. |
| Koramangala | Koramangala | relation / way | Polygon | GOOD | Clear polygon covering all blocks. |
| Indiranagar | Indira Nagar | way | Polygon | GOOD | Polygon exists, alias required for "Indiranagar". |
| Whitefield | Whitefield | node / way | Polygon | GOOD | Polygon exists but is very large. |
| Bellandur | Bellandur | way | Polygon | GOOD | Defined boundary near the lake. |
| BTM Layout | BTM Layout | relation / way | Polygon | GOOD | Distinct polygon covering stages. |
| JP Nagar | J. P. Nagar | relation / way | Polygon | GOOD | Alias required. |
| Jayanagar | Jayanagar | relation / way | Polygon | GOOD | Well-defined block structure. |
| Marathahalli | Marathahalli | node / way | Polygon | USABLE WITH CAVEATS | Polygon exists but borders are colloquial and fuzzy. |
| Electronic City | Electronic City | relation / way | Polygon | GOOD | Split into Phase 1 and 2, overall boundary exists. |
| Sarjapur Road | Sarjapur Road | line | None (Road) | AMBIGUOUS / MISSING | It is a road (`highway=*`), not a bounded polygon locality. Users treat the corridor as a locality. Needs manual fallback geometry. |
| Hebbal | Hebbal | node / way | Polygon | GOOD | |
| Yelahanka | Yelahanka | relation / way | Polygon | GOOD | |
| Mahadevapura | Mahadevapura | relation / way | Polygon | GOOD | |
| Banashankari | Banashankari | relation / way | Polygon | GOOD | |
| RR Nagar | Rajarajeshwari Nagar | relation / way | Polygon | GOOD | Alias "RR Nagar" required. |
| Malleshwaram | Malleshwaram | way | Polygon | GOOD | |
| Rajajinagar | Rajajinagar | relation / way | Polygon | GOOD | |
| Basavanagudi | Basavanagudi | way | Polygon | GOOD | |
| Domlur | Domlur | way | Polygon | GOOD | |
| Brookefield | Brookefield | node / way | Polygon | GOOD | |
| Kadubeesanahalli | Kadubeesanahalli | node | Point Only | POINT ONLY | Often mapped as a node, borders are highly disputed/colloquial. |
| Hoodi | Hoodi | node / way | Polygon | GOOD | |
| KR Puram | Krishnarajapura | node / relation | Polygon | GOOD | Alias "KR Puram" required. |
| CV Raman Nagar | C. V. Raman Nagar | way | Polygon | GOOD | |
| Frazer Town | Frazer Town | node / way | Polygon | GOOD | Also mapped as Pulakeshinagar. |
| Kalyan Nagar | Kalyan Nagar | node / way | Polygon | GOOD | |
| Kammanahalli | Kammanahalli | way | Polygon | GOOD | |
| Bannerghatta Road | Bannerghatta Road | line | None (Road) | AMBIGUOUS / MISSING | Corridor, not a polygon. Needs manual fallback. |
| Thanisandra | Thanisandra | node / way | Polygon | GOOD | |

## Validation Summary
- **Localities with Good Polygons**: 26 / 30
- **Localities Requiring Fallbacks**: 4 / 30 (Sarjapur Road, Bannerghatta Road, Kadubeesanahalli, and potentially Marathahalli due to fuzziness).

## Conclusion
The assumption that most major areas have OSM polygons holds true for traditional layouts. However, "Road" localities (which users treat as neighbourhoods) lack polygons completely. A fixed 1.5km buffer is insufficient because a corridor like Sarjapur Road is much longer and differently shaped than a point. Manual curation of fallback geometries is required.
