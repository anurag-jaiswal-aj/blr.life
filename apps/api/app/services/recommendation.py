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
    metro_distance_m: float | None = None
    metro_confidence: str | None = None
    metro_extra_data: dict[str, Any] | None = None
    cafe_count: float | None = None
    cafe_confidence: str | None = None
    restaurant_count: float | None = None
    restaurant_confidence: str | None = None
    park_count: float | None = None
    park_confidence: str | None = None
    healthcare_count: float | None = None
    healthcare_confidence: str | None = None
    nightlife_count: float | None = None
    nightlife_confidence: str | None = None
    calc_version: str | None = None
    rent_min_inr: int | None = None
    rent_max_inr: int | None = None


# -----------------------------------------------------------------------------
# Empirical Amenity Normalization Caps
# -----------------------------------------------------------------------------
# Derived from Geofabrik Karnataka OSM Extract (karnataka-latest.osm.pbf)
# Date: 2026-08-03
# Methodology: 90th percentile (P90) of raw amenity counts across 37
# canonical Bengaluru localities using `numpy.percentile(arr, 90)`
# (linear interpolation) and truncated to integer `int()`.
# -----------------------------------------------------------------------------
CAFE_CAP = 59.0
RESTAURANT_CAP = 143.0
PARK_CAP = 41.0
HEALTHCARE_CAP = 83.0
NIGHTLIFE_CAP = 25.0


def normalize_amenity(count: float | None, confidence: str | None, cap: float) -> float | None:
    if count is None or confidence in ["insufficient", "low", None]:
        return None
    return min(count, cap) / cap


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

    # Affordability explanations
    if constraints.max_budget_inr is not None and constraints.bhk_type is not None:
        if candidate.rent_min_inr is None:
            warnings.append(
                f"Rent data unavailable for {constraints.bhk_type}. Affordability unknown."
            )
        elif candidate.rent_min_inr <= constraints.max_budget_inr:
            pros.append(
                f"Observed {constraints.bhk_type} rent band (from "
                f"₹{candidate.rent_min_inr:,}) overlaps your budget."
            )

    # Amenity explanations
    amenities = [
        ("cafe", candidate.cafe_count, candidate.cafe_confidence, CAFE_CAP),
        ("restaurant", candidate.restaurant_count, candidate.restaurant_confidence, RESTAURANT_CAP),
        ("park", candidate.park_count, candidate.park_confidence, PARK_CAP),
        ("healthcare", candidate.healthcare_count, candidate.healthcare_confidence, HEALTHCARE_CAP),
        ("nightlife", candidate.nightlife_count, candidate.nightlife_confidence, NIGHTLIFE_CAP),
    ]
    for name, count, conf, cap in amenities:
        norm = normalize_amenity(count, conf, cap)
        if norm is None:
            warnings.append(f"{name.capitalize()} data unavailable")
        elif norm >= 0.8:
            pros.append(f"High {name} count within 1.5km")
        elif norm >= 0.4:
            pros.append(f"Moderate {name} count within 1.5km")
        else:
            warnings.append(f"Low {name} count within 1.5km")

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

        if (
            constraints.max_budget_inr is not None
            and constraints.bhk_type is not None
            and candidate.rent_min_inr is not None
            and candidate.rent_min_inr > constraints.max_budget_inr
        ):
            continue

        # Normalization
        norm_metro = normalize_metro_distance(
            candidate.metro_distance_m, candidate.metro_confidence
        )
        norm_work = normalize_work_distance(candidate.work_distance_km)

        norm_cafe = normalize_amenity(candidate.cafe_count, candidate.cafe_confidence, CAFE_CAP)
        norm_restaurant = normalize_amenity(
            candidate.restaurant_count, candidate.restaurant_confidence, RESTAURANT_CAP
        )
        norm_park = normalize_amenity(candidate.park_count, candidate.park_confidence, PARK_CAP)
        norm_healthcare = normalize_amenity(
            candidate.healthcare_count, candidate.healthcare_confidence, HEALTHCARE_CAP
        )
        norm_nightlife = normalize_amenity(
            candidate.nightlife_count, candidate.nightlife_confidence, NIGHTLIFE_CAP
        )

        # Weighted Score
        w_metro = preferences.metro_access_weight
        w_work = preferences.short_commute_weight
        w_cafe = preferences.cafe_weight
        w_restaurant = preferences.restaurant_weight
        w_park = preferences.park_weight
        w_healthcare = preferences.healthcare_weight
        w_nightlife = preferences.nightlife_weight

        total_selected_weights = (
            w_metro + w_work + w_cafe + w_restaurant + w_park + w_healthcare + w_nightlife
        )
        score_sum = 0.0

        if norm_metro is not None:
            score_sum += w_metro * norm_metro

        score_sum += w_work * norm_work

        if norm_cafe is not None:
            score_sum += w_cafe * norm_cafe

        if norm_restaurant is not None:
            score_sum += w_restaurant * norm_restaurant

        if norm_park is not None:
            score_sum += w_park * norm_park

        if norm_healthcare is not None:
            score_sum += w_healthcare * norm_healthcare

        if norm_nightlife is not None:
            score_sum += w_nightlife * norm_nightlife

        if total_selected_weights <= 0:
            total_score = 0.0
        else:
            total_score = (score_sum / total_selected_weights) * 100.0

        explanations = generate_explanations(candidate, constraints)

        metadata: dict[str, Any] = {"coordinates": {"lat": candidate.lat, "lng": candidate.lng}}
        if candidate.metro_extra_data:
            metadata["nearest_metro_station"] = {
                "name": candidate.metro_extra_data.get("nearest_station_name"),
                "slug": candidate.metro_extra_data.get("nearest_station_slug"),
                "line": candidate.metro_extra_data.get("nearest_station_line"),
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
                    cafe=round(norm_cafe, 4) if norm_cafe is not None else None,
                    restaurant=round(norm_restaurant, 4) if norm_restaurant is not None else None,
                    park=round(norm_park, 4) if norm_park is not None else None,
                    healthcare=round(norm_healthcare, 4) if norm_healthcare is not None else None,
                    nightlife=round(norm_nightlife, 4) if norm_nightlife is not None else None,
                ),
                raw_metrics=RawMetrics(
                    metro_distance_m=candidate.metro_distance_m,
                    work_distance_km=round(candidate.work_distance_km, 2),
                    cafe_accessibility=candidate.cafe_count,
                    restaurant_accessibility=candidate.restaurant_count,
                    park_accessibility=candidate.park_count,
                    healthcare_accessibility=candidate.healthcare_count,
                    nightlife_accessibility=candidate.nightlife_count,
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
