# Recommendation Engine

## Core Philosophy
The V1 recommendation engine is deterministic and mathematical. It does not use LLMs to score neighbourhoods. This ensures responses are fast, cheap, and 100% explainable.

## Workflow

1. **Candidate Generation**: Fetch all active areas from the database.
2. **Hard Constraint Filtering**:
   - Filter out areas where the minimum estimated rent is significantly higher than the user's `max_rent`.
   - Filter out areas where the `commute_estimate_mins` is strictly greater than `max_commute_mins` + 15 mins (allowing a slight buffer).
3. **Feature Representation**: Fetch normalized metrics (0.0 to 1.0) for remaining areas for each preference factor (e.g., `metro_score`, `nightlife_score`).
4. **Weighted Scoring**: Apply user preference weights to the normalized metrics.
5. **Ranking**: Sort by the final `BLR Score`.
6. **Explanation Generation**: Derive human-readable pros/cons based on which score components contributed most positively or negatively.

## The BLR Score Formula

```text
Area_Score = (w_1 * M_1) + (w_2 * M_2) + ... + (w_n * M_n)
```
Where:
- `w` is the weight of the preference (e.g., High = 1.0, Medium = 0.5, Low = 0.1).
- `M` is the normalized metric for the area (0.0 to 1.0).

The final `BLR Score` is scaled to 100.

## Explainability
The engine must be able to answer: *"Why was HSR recommended above Bellandur?"*

It does this by comparing the `RecommendationScoreComponent` for both.
Example:
- HSR Score: 91. Reason: High `metro_score` (0.9), High `cafe_score` (0.95), Commute 30 mins.
- Bellandur Score: 87. Reason: Low `metro_score` (0.2), High `cafe_score` (0.8), Commute 15 mins.
Because the user heavily weighted Metro Access (`w = 1.0`) over Short Commute (`w = 0.5`), HSR won. The UI will explain exactly this.

## Handling Missing or Stale Data
If an `AreaMetric` has a `confidence_score` of 0 (missing):
- It contributes 0 to the score.
- The `explanation_text` must explicitly state: "We lack data for [Metric] in this area, which negatively impacted its score."

## Future Evolution
A machine-learning model (Learning to Rank - LTR) could eventually replace the deterministic weighting step. However, the data contracts (Inputs -> Features -> Explainable Output) must remain the same so the UI doesn't break. This requires significant historical usage data, which V1 does not have.
