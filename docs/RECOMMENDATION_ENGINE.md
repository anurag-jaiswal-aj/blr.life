# Recommendation Engine

## Core Philosophy
The V1 recommendation engine is deterministic and mathematical. It does not use LLMs to score neighbourhoods. This ensures responses are fast, cheap, and 100% explainable.

## Workflow

1. **Candidate Generation**: Fetch all active areas from the database.
2. **Hard Constraint Filtering**:
   - `max_work_distance_km`: Filter out areas where the straight-line work distance exceeds the maximum allowed distance.
   - Note: In V1, rent data is deferred. The schema forbids `max_rent_inr` and strictly rejects unsupported constraints with a 422 error.
3. **Feature Representation**: Normalize metrics to a (0.0 to 1.0) scale for remaining areas:
   - *Metro Access*: `1.0` if <= 500m, decays to `0.0` at 3000m.
   - *Work Distance*: `1.0` if <= 2km, decays to `0.0` at 15km.
   - *Amenity Density*: `min(raw_count / cap, 1.0)`. **Empirical Calibration**: The V1 caps are empirically calibrated against a 37-locality dataset derived from the Geofabrik Southern India OSM extract (snapshot dated 2026-08-03). The caps represent the P90 (90th percentile) of raw 1.5km accessibility counts, calculated using `numpy.percentile(values, 90)` (linear interpolation) and truncated via `int()`.
     - Cafe = 59 (Exact float: 59.60)
     - Restaurant = 143 (Exact float: 143.80)
     - Park = 41 (Exact float: 41.60)
     - Healthcare = 83 (Exact float: 83.80)
     - Nightlife = 25 (Exact float: 25.20)
     *Note: These represent actual density heuristics within the specific OSM snapshot and extraction methodology. They are not universal quality thresholds or dynamic request-time percentiles. They will require recalibration if the source dataset materially changes.*
4. **Weighted Scoring**: Apply user preference weights to the normalized metrics. If a locality lacks a metric (or has insufficient confidence), its active weights are renormalized.
5. **Ranking**: Sort by the final `BLR Score` (with a deterministic tie-breaker on locality slug).
6. **Explanation Generation**: Derive human-readable pros/cons and warnings based on metric values and missing data.

## The BLR Score Formula

```text
Area_Score = sum(w_i * M_i) / sum(w_i for active metrics)
```
Where:
- `w` is the weight of the preference (e.g., High = 1.0, Medium = 0.5, Low = 0.0).
- `M` is the normalized metric for the area (0.0 to 1.0).

The final `BLR Score` is scaled to 100. If an area lacks data for a dimension, the weight for that dimension is excluded from the denominator.

## Explainability
The engine must be able to answer: *"Why was HSR recommended above Bellandur?"*

It does this by returning component scores and explicit pros/warnings.
Example:
- HSR Score: 91. Reason: Strong metro access, Close to work.
- Bellandur Score: 87. Reason: Limited metro access, Close to work.

Because the user heavily weighted Metro Access (`w = 1.0`) over Short Commute (`w = 0.5`), HSR won. The UI will explain exactly this.

## Missing-Data & Confidence Policy
If an `AreaMetric` is missing for a specific locality, or if the metric has `INSUFFICIENT` or `LOW` confidence:
- The metric is treated as unavailable and its component score will be `null`.
- It does not contribute to the score numerator, and its weight is removed from the active weight denominator so the locality is not unfairly penalized.
- The `explanation_text` explicitly states: `"Metro proximity data unavailable"` or `"Metro proximity data has insufficient confidence"`.

We strictly distinguish between "Unknown/Low Confidence" (treated as unavailable) and "Known Poor Access" (treated as a low score).

## Spatial Heuristics vs Routing (V1)
In V1, OSRM routing is deferred. To maintain determinism without fabricating commute times, the engine relies on a **spatial heuristic proxy**: `work_distance_km`. This represents the geodesic straight-line distance computed dynamically via PostGIS (`ST_DistanceSphere`). Users input a maximum distance tolerance, rather than arbitrary minutes.

## Future Evolution
- OSRM will eventually replace straight-line work distances with precise routing geometries and peak-hour commute times.
- A machine-learning model (Learning to Rank - LTR) could eventually replace the deterministic weighting step. However, the data contracts (Inputs -> Features -> Explainable Output) must remain the same so the UI doesn't break.
