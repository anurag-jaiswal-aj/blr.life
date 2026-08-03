from app.schemas.recommendation import RecommendationConstraints, RecommendationPreferences
from app.services.recommendation import (
    CandidateLocality,
    generate_explanations,
    normalize_metro_distance,
    normalize_work_distance,
    rank_candidates,
)


def test_metro_normalization_bounds() -> None:
    # <= 500m
    assert normalize_metro_distance(0.0, "high") == 1.0
    assert normalize_metro_distance(500.0, "medium") == 1.0

    # 500m - 3000m (linear decay)
    assert normalize_metro_distance(1750.0, "high") == 0.5

    # >= 3000m
    assert normalize_metro_distance(3000.0, "high") == 0.0
    assert normalize_metro_distance(5000.0, "high") == 0.0

    # Missing or insufficient confidence
    assert normalize_metro_distance(None, "high") is None
    assert normalize_metro_distance(500.0, "insufficient") is None
    assert normalize_metro_distance(500.0, "low") is None
    assert normalize_metro_distance(500.0, None) is None


def test_work_normalization_bounds() -> None:
    # <= 2km
    assert normalize_work_distance(0.0) == 1.0
    assert normalize_work_distance(2.0) == 1.0

    # 2km - 15km
    assert normalize_work_distance(8.5) == 0.5

    # >= 15km
    assert normalize_work_distance(15.0) == 0.0
    assert normalize_work_distance(20.0) == 0.0


def test_score_calculation_weights() -> None:
    c1 = CandidateLocality(
        id=1,
        slug="hsr-layout",
        name="HSR Layout",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,  # norm = 1.0
        metro_distance_m=500.0,  # norm = 1.0
        metro_confidence="high",
        metro_extra_data=None,
        calc_version=None,
    )
    c2 = CandidateLocality(
        id=2,
        slug="bellandur",
        name="Bellandur",
        lat=12.0,
        lng=77.0,
        work_distance_km=15.0,  # norm = 0.0
        metro_distance_m=3000.0,  # norm = 0.0
        metro_confidence="high",
        metro_extra_data=None,
        calc_version=None,
    )
    c3 = CandidateLocality(
        id=3,
        slug="indiranagar",
        name="Indiranagar",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,  # norm = 1.0
        metro_distance_m=3000.0,  # norm = 0.0
        metro_confidence="high",
        metro_extra_data=None,
        calc_version=None,
    )
    c4 = CandidateLocality(
        id=4,
        slug="missing-metro",
        name="Missing Metro",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,  # norm = 1.0
        metro_distance_m=None,  # norm = None
        metro_confidence=None,
        metro_extra_data=None,
        calc_version=None,
    )
    c5 = CandidateLocality(
        id=5,
        slug="insufficient-metro",
        name="Insufficient Metro",
        lat=12.0,
        lng=77.0,
        work_distance_km=15.0,  # norm = 0.0
        metro_distance_m=500.0,  # norm = None (due to confidence)
        metro_confidence="insufficient",
        metro_extra_data=None,
        calc_version=None,
    )

    constraints = RecommendationConstraints()

    # Equal weights
    prefs_equal = RecommendationPreferences(metro_access_weight=1.0, short_commute_weight=1.0)
    results, _ = rank_candidates([c1, c2, c3, c4, c5], constraints, prefs_equal, limit=10)

    # c1: (1*1 + 1*1) / 2 = 100
    # c4: (1*1) / 1 = 100
    # c3: (1*1 + 1*0) / 2 = 50
    # c2: (1*0 + 1*0) / 2 = 0
    # c5: (1*0) / 1 = 0

    # Sort order (score DESC, slug ASC)
    assert results[0].slug == "hsr-layout"
    assert results[0].total_score == 100.0
    assert results[1].slug == "missing-metro"
    assert results[1].total_score == 100.0
    assert results[1].component_scores.metro is None
    assert results[2].slug == "indiranagar"
    assert results[2].total_score == 50.0
    assert results[3].slug == "bellandur"
    assert results[3].total_score == 0.0
    assert results[4].slug == "insufficient-metro"
    assert results[4].total_score == 0.0
    assert results[4].component_scores.metro is None

    # Favor work distance
    prefs_work = RecommendationPreferences(metro_access_weight=0.0, short_commute_weight=1.0)
    results_work, _ = rank_candidates([c1, c2, c3], constraints, prefs_work, limit=10)
    assert results_work[0].slug == "hsr-layout"
    assert results_work[0].total_score == 100.0
    assert results_work[1].slug == "indiranagar"
    assert results_work[1].total_score == 100.0

    # Favor metro distance
    prefs_metro = RecommendationPreferences(metro_access_weight=1.0, short_commute_weight=0.0)
    results_metro, _ = rank_candidates([c1, c4], constraints, prefs_metro, limit=10)
    assert results_metro[0].slug == "hsr-layout"
    assert results_metro[0].total_score == 100.0
    assert results_metro[1].slug == "missing-metro"
    assert results_metro[1].total_score == 0.0


def test_explanation_generation_rules() -> None:
    c_good = CandidateLocality(
        id=1,
        slug="a",
        name="a",
        lat=12.0,
        lng=77.0,
        work_distance_km=4.0,
        metro_distance_m=800.0,
        metro_confidence="high",
        metro_extra_data=None,
        calc_version=None,
    )
    c_bad = CandidateLocality(
        id=2,
        slug="b",
        name="b",
        lat=12.0,
        lng=77.0,
        work_distance_km=16.0,
        metro_distance_m=4000.0,
        metro_confidence="high",
        metro_extra_data=None,
        calc_version=None,
    )
    c_missing = CandidateLocality(
        id=3,
        slug="c",
        name="c",
        lat=12.0,
        lng=77.0,
        work_distance_km=10.0,
        metro_distance_m=None,
        metro_confidence=None,
        metro_extra_data=None,
        calc_version=None,
    )
    c_insufficient = CandidateLocality(
        id=4,
        slug="d",
        name="d",
        lat=12.0,
        lng=77.0,
        work_distance_km=10.0,
        metro_distance_m=800.0,
        metro_confidence="insufficient",
        metro_extra_data=None,
        calc_version=None,
    )

    constraints = RecommendationConstraints()

    ex_good = generate_explanations(c_good, constraints)
    assert "Strong metro access" in ex_good.pros
    assert "Close to work" in ex_good.pros
    assert len([w for w in ex_good.warnings if "metro" in w.lower() or "work" in w.lower()]) == 0

    ex_bad = generate_explanations(c_bad, constraints)
    assert "Limited metro access" in ex_bad.warnings
    assert "Far from work location" in ex_bad.warnings

    ex_missing = generate_explanations(c_missing, constraints)
    assert "Metro proximity data unavailable" in ex_missing.warnings

    ex_insufficient = generate_explanations(c_insufficient, constraints)
    assert "Metro proximity data has insufficient confidence" in ex_insufficient.warnings


def test_tie_breaking_slug_asc() -> None:
    c1 = CandidateLocality(
        id=1,
        slug="z-area",
        name="Z Area",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,
        metro_distance_m=500.0,
        metro_confidence="high",
        metro_extra_data=None,
        calc_version=None,
    )
    c2 = CandidateLocality(
        id=2,
        slug="a-area",
        name="A Area",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,
        metro_distance_m=500.0,
        metro_confidence="high",
        metro_extra_data=None,
        calc_version=None,
    )

    constraints = RecommendationConstraints()
    prefs = RecommendationPreferences()
    results, _ = rank_candidates([c1, c2], constraints, prefs, limit=10)

    assert results[0].slug == "a-area"
    assert results[1].slug == "z-area"


def test_hard_constraint_work_distance() -> None:
    c1 = CandidateLocality(
        id=1,
        slug="near",
        name="Near",
        lat=12.0,
        lng=77.0,
        work_distance_km=5.0,
        metro_distance_m=500.0,
        metro_confidence="high",
        metro_extra_data=None,
        calc_version=None,
    )
    c2 = CandidateLocality(
        id=2,
        slug="far",
        name="Far",
        lat=12.0,
        lng=77.0,
        work_distance_km=20.0,
        metro_distance_m=500.0,
        metro_confidence="high",
        metro_extra_data=None,
        calc_version=None,
    )

    constraints = RecommendationConstraints(max_work_distance_km=10.0)
    prefs = RecommendationPreferences()
    results, _ = rank_candidates([c1, c2], constraints, prefs, limit=10)

    assert len(results) == 1
    assert results[0].slug == "near"


def test_amenity_scoring_and_renormalization() -> None:
    c1 = CandidateLocality(
        id=1,
        slug="all-amenities",
        name="All Amenities",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,  # 1.0
        metro_distance_m=500.0,  # 1.0
        metro_confidence="high",
        cafe_count=59.0,
        cafe_confidence="high",  # 1.0
        restaurant_count=143.0,
        restaurant_confidence="high",  # 1.0
        park_count=0.0,
        park_confidence="high",  # 0.0
    )
    c2 = CandidateLocality(
        id=2,
        slug="missing-amenity",
        name="Missing Amenity",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,  # 1.0
        metro_distance_m=500.0,  # 1.0
        metro_confidence="high",
        cafe_count=59.0,
        cafe_confidence="high",  # 1.0
        restaurant_count=143.0,
        restaurant_confidence="high",  # 1.0
        park_count=None,
        park_confidence=None,  # Missing
    )
    c3 = CandidateLocality(
        id=3,
        slug="low-amenity",
        name="Low Amenity",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,  # 1.0
        metro_distance_m=500.0,  # 1.0
        metro_confidence="high",
        cafe_count=0.0,
        cafe_confidence="high",  # 0.0
        restaurant_count=0.0,
        restaurant_confidence="high",  # 0.0
        park_count=41.0,
        park_confidence="high",  # 1.0
    )

    constraints = RecommendationConstraints()
    # Weights: work=1, metro=1, cafe=1, restaurant=1, park=1
    prefs = RecommendationPreferences(
        metro_access_weight=1.0,
        short_commute_weight=1.0,
        cafe_weight=1.0,
        restaurant_weight=1.0,
        park_weight=1.0,
    )

    results, _ = rank_candidates([c1, c2, c3], constraints, prefs, limit=10)

    # c1: (1+1+1+1+0) / 5 = 0.8 = 80.0
    # c2: (1+1+1+1) / 4 = 1.0 = 100.0 (Park is missing, so denominator renormalizes to 4!)
    # c3: (1+1+0+0+1) / 5 = 0.6 = 60.0

    assert results[0].slug == "missing-amenity"
    assert results[0].total_score == 100.0
    assert results[0].component_scores.park is None

    assert results[1].slug == "all-amenities"
    assert results[1].total_score == 80.0
    assert results[1].component_scores.park == 0.0

    assert results[2].slug == "low-amenity"
    assert results[2].total_score == 60.0


def test_amenity_explanations() -> None:
    c = CandidateLocality(
        id=1,
        slug="test",
        name="Test",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,
        metro_distance_m=500.0,
        metro_confidence="high",
        cafe_count=50.0,
        cafe_confidence="high",  # Strong (50/59 = 0.84)
        restaurant_count=72.0,
        restaurant_confidence="high",  # Moderate (72/143 = 0.5)
        park_count=8.0,
        park_confidence="high",  # Limited (8/41 = 0.2)
        healthcare_count=None,
        healthcare_confidence=None,  # Unavailable
    )
    constraints = RecommendationConstraints()
    ex = generate_explanations(c, constraints)

    assert "High cafe count within 1.5km" in ex.pros
    assert "Moderate restaurant count within 1.5km" in ex.pros
    assert "Low park count within 1.5km" in ex.warnings
    assert "Healthcare data unavailable" in ex.warnings


def test_recommendation_preferences_backward_compatibility() -> None:
    prefs = RecommendationPreferences(
        metro_access_weight=1.0,
        short_commute_weight=1.0,
    )
    assert prefs.cafe_weight == 0.0
    assert prefs.restaurant_weight == 0.0
    assert prefs.park_weight == 0.0
    assert prefs.healthcare_weight == 0.0
    assert prefs.nightlife_weight == 0.0
