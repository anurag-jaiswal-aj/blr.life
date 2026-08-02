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
    assert len(ex_good.warnings) == 0

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

