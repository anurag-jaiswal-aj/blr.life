from dataclasses import dataclass
from typing import Any

from app.schemas.recommendation import (
    ComponentScores,
    RawMetrics,
    RecommendationConstraints,
    RecommendationExplanations,
    RecommendationPreferences,
    RecommendationResult,
)


@dataclass
class CandidateLocality:
    id: int
    slug: str
    name: str
    lat: float
    lng: float
    work_distance_km: float
    metro_distance_m: float | None
    metro_confidence: str | None
    metro_extra_data: dict[str, Any] | None
    calc_version: str | None


def normalize_metro_distance(distance_m: float | None, confidence: str | None) -> float | None:
    """
    Normalize metro distance to a [0, 1] score.
    Returns None if missing or if confidence is INSUFFICIENT or LOW (since it is
    not explicitly permitted).
    """
    if distance_m is None or confidence in ["insufficient", "low", None]:
        return None
    if distance_m <= 500.0:
        return 1.0
    if distance_m >= 3000.0:
        return 0.0
    return (3000.0 - distance_m) / 2500.0


def normalize_work_distance(distance_km: float) -> float:
    """
    Normalize straight-line work distance to a [0, 1] score.
    <= 2km: 1.0
    2km to 15km: Linear decay
    > 15km: 0.0
    """
    if distance_km <= 2.0:
        return 1.0
    if distance_km >= 15.0:
        return 0.0
    return (15.0 - distance_km) / 13.0


def generate_explanations(
    candidate: CandidateLocality, constraints: RecommendationConstraints
) -> RecommendationExplanations:
    pros: list[str] = []
    warnings: list[str] = []

    # Metro explanations
    norm_metro = normalize_metro_distance(candidate.metro_distance_m, candidate.metro_confidence)
    if norm_metro is None:
        if candidate.metro_confidence in ["insufficient", "low"]:
            warnings.append("Metro proximity data has insufficient confidence")
        else:
            warnings.append("Metro proximity data unavailable")
    elif candidate.metro_distance_m is not None and candidate.metro_distance_m <= 1000.0:
        pros.append("Strong metro access")
    elif candidate.metro_distance_m is not None and candidate.metro_distance_m <= 3000.0:
        pros.append("Moderate metro access")
    else:
        warnings.append("Limited metro access")

    # Work distance explanations
    if candidate.work_distance_km <= 5.0:
        pros.append("Close to work")
    elif candidate.work_distance_km > 15.0:
        warnings.append("Far from work location")

    # Missing rent data warning if budget provided
    # The max_rent_inr has been removed from constraints, so this block is no longer needed.
    # However, if any unsupported constraints were present (but blocked by schema forbid),
    # they would have failed validation.

    return RecommendationExplanations(pros=pros, warnings=warnings)


def rank_candidates(
    candidates: list[CandidateLocality],
    constraints: RecommendationConstraints,
    preferences: RecommendationPreferences,
    limit: int,
) -> tuple[list[RecommendationResult], list[str]]:
    """
    Filter, score, and rank candidates, returning the top results and provenance.
    """
    results: list[RecommendationResult] = []
    calc_versions_used = set()

    for candidate in candidates:
        # Hard Constraints Filter
        if (
            constraints.max_work_distance_km is not None
            and candidate.work_distance_km > constraints.max_work_distance_km
        ):
            continue

        # Normalization
        norm_metro = normalize_metro_distance(
            candidate.metro_distance_m, candidate.metro_confidence
        )
        norm_work = normalize_work_distance(candidate.work_distance_km)

        # Weighted Score
        w_metro = preferences.metro_access_weight
        w_work = preferences.short_commute_weight
        
        available_weight_sum = 0.0
        score_sum = 0.0

        if norm_metro is not None:
            available_weight_sum += w_metro
            score_sum += w_metro * norm_metro
            
        available_weight_sum += w_work
        score_sum += w_work * norm_work

        if available_weight_sum <= 0:
            total_score = 0.0
        else:
            total_score = (score_sum / available_weight_sum) * 100.0

        explanations = generate_explanations(candidate, constraints)

        metadata: dict[str, Any] = {
            "coordinates": {"lat": candidate.lat, "lng": candidate.lng}
        }
        if candidate.metro_extra_data:
            metadata["nearest_metro_station"] = {
                "name": candidate.metro_extra_data.get("nearest_station_name"),
                "slug": candidate.metro_extra_data.get("nearest_station_slug"),
            }

        if candidate.calc_version:
            calc_versions_used.add(candidate.calc_version)

        results.append(
            RecommendationResult(
                locality_id=candidate.id,
                slug=candidate.slug,
                name=candidate.name,
                rank=0,  # placeholder, set after sort
                total_score=round(total_score, 2),
                component_scores=ComponentScores(
                    metro=round(norm_metro, 4) if norm_metro is not None else None,
                    work_distance=round(norm_work, 4),
                ),
                raw_metrics=RawMetrics(
                    metro_distance_m=candidate.metro_distance_m,
                    work_distance_km=round(candidate.work_distance_km, 2),
                ),
                metadata=metadata,
                explanations=explanations,
            )
        )

    # Deterministic Tie-breaking: score DESC, slug ASC
    results.sort(key=lambda r: (-r.total_score, r.slug))

    # Apply rank and limit
    final_results = []
    for idx, result in enumerate(results[:limit]):
        result.rank = idx + 1
        final_results.append(result)

    return final_results, sorted(list(calc_versions_used))
