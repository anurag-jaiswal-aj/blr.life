# Geography V1 Product Audit

## 1. Objective

Determine whether complete locality boundary polygons are actually required for blr.life V1, based on the current implemented map UX and product behavior. This audit analyzes the frontend implementation, map capabilities, and feature dependencies on polygon geometry.

## 2. Current Map Capabilities

The map currently centers around the user's selected workplace (marked with a "WORK" pin) and displays locality recommendations as discrete rank-numbered point markers using the locality's centroid geometry. 

Users can:
- Set their workplace by clicking on the map.
- View recommended localities as rank-numbered markers (sizes scale on selection/hover).
- Select localities by clicking on the marker or via the list view.
- View locality details and comparisons which update based on ID.

The map automatically pans and zooms to fit bounds based purely on the work location and locality centroids, without relying on polygon geometries.

## 3. Feature Dependency on Polygon Geometry

| Feature | Polygon Required? | Evidence |
|---|---|---|
| **Selecting a locality** | DOES NOT REQUIRE POLYGON | Selection is handled via `onClick` on the centroid `<Marker>` or via list interactions in `RecommendationWorkspace`. |
| **Understanding locality location** | BENEFITS FROM POLYGON | A point marker shows general location, but a polygon would visually clarify the neighbourhood's exact extent and borders. |
| **Comparing localities** | DOES NOT REQUIRE POLYGON | Comparison relies on `locality_id` state and statistical/metric data, not geometry. |
| **Seeing recommendation results** | DOES NOT REQUIRE POLYGON | Results are effectively rendered using centroid coordinates (`metadata.coordinates`) and rank numbers. |
| **Viewing commute distance** | DOES NOT REQUIRE POLYGON | Distance metrics are calculated algorithmically based on centroid distances to the work point. |
| **Viewing metro distance** | DOES NOT REQUIRE POLYGON | Metro distance is calculated using the locality centroid. |
| **Saved localities** | DOES NOT REQUIRE POLYGON | Saved state relies purely on `locality_id` arrays in the URL/state. |
| **Shareable URL state** | DOES NOT REQUIRE POLYGON | State uses parameters like `lat`, `lng`, weights, and `locality_id`, entirely independent of geometry. |
| **Mobile UX** | DOES NOT REQUIRE POLYGON | Mobile operates via a bottom sheet and centroid markers without breaking. |
| **Desktop UX** | DOES NOT REQUIRE POLYGON | Desktop uses a 3-pane layout interacting smoothly via centroid selections. |

## 4. Current Polygon Rendering Path

The rendering path traces from the API down to the MapLibre components:
1. `geometry_geojson` is optionally provided in the `RecommendationResult`.
2. Inside `MapContainer.tsx`, a `useMemo` hook builds a `FeatureCollection` by explicitly filtering out localities without geometry: `.filter((rec) => rec.geometry_geojson)`.
3. If features exist, they are passed to a MapLibre `<Source>` and rendered via fill and line `<Layer>` components.

**Findings:**
- **Path Exercised:** Currently, this path is NOT exercised with V1 data because the database contains exactly 0 polygon geometries for the 37 localities.
- **Dependency:** There is absolutely no hard dependency on polygons. The map and its features function entirely independently of the polygon source.
- **Null Safety:** Missing/null geometry is handled completely safely by filtering them out before rendering.

## 5. UX Gaps Without Polygon Boundaries

Based strictly on the current implementation, the absence of polygons creates the following UX limitations:
- **Unclear Boundary Extent:** Users cannot visually determine where a locality starts or ends. The centroid gives a center, but not the scale or shape of the neighbourhood.
- **Visual Crowding / Overlap:** Because only discrete point markers are used, localities that are geographically close or very small may have their markers visually overlap at certain zoom levels.
- **Hit Target Size:** While the markers enlarge on hover/selection, a polygon would provide a much larger and more accurate interactive hit target for selection on the map.

## 6. V1 Product Implications

- **Already Works:** Core interactions—searching, ranking, selecting, saving, comparing, and viewing distance metrics—are fully functional using only the locality centroids.
- **Enhanced by Polygons:** Visual comprehension of the neighbourhood size, shape, and exact borders would be significantly improved by rendering polygons, providing a more premium feel.
- **Requires Polygons:** **No current V1 feature genuinely requires polygon boundaries.**

## 7. Open Product Questions

- Given that polygons only offer a visual enhancement without enabling new core functionality, should we completely defer polygon ingestion to V2?
- Are the current rank-numbered point markers intuitive enough for users to understand the rough area of the neighbourhood without explicit boundaries?
- Does the lack of visual boundaries negatively impact the perceived trust or accuracy of the recommendation engine?
