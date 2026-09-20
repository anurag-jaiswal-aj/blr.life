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
    # c3: (1*1 + 1*0) / 2 = 50
    # c4: (1*1) / 1 = 100 (metro missing, so denominator is 1)
    # c2: (1*0 + 1*0) / 2 = 0
    # c5: (1*0) / 1 = 0 (metro missing, so denominator is 1)

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
    # c2: (1+1+1+1) / 4 = 1.0 = 100.0 (Park is missing, contributes 0, weight removed)
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


def test_score_contributions() -> None:
    prefs = RecommendationPreferences(
        metro_access_weight=1.0,
        short_commute_weight=1.0,
        cafe_weight=0.5,
    )
    constraints = RecommendationConstraints()
    candidate_perfect = CandidateLocality(
        id=1,
        slug="perfect",
        name="Perfect",
        lat=12.0,
        lng=77.0,
        metro_distance_m=0.0,
        metro_confidence="high",
        work_distance_km=0.0,
        cafe_count=50,
        cafe_confidence="high",
    )
    candidate_missing_metro = CandidateLocality(
        id=2,
        slug="missing-metro",
        name="Missing Metro",
        lat=12.0,
        lng=77.0,
        metro_distance_m=None,
        metro_confidence=None,
        work_distance_km=0.0,
        cafe_count=50,
        cafe_confidence="high",
    )

    results, _ = rank_candidates(
        [candidate_perfect, candidate_missing_metro], constraints, prefs, limit=10
    )

    perf = next(r for r in results if r.slug == "perfect")
    miss = next(r for r in results if r.slug == "missing-metro")

    # total selected weights = 1.0 (metro) + 1.0 (work) + 0.5 (cafe) = 2.5
    # perf contrib:
    # metro = 1.0 * 1.0 / 2.5 * 100 = 40.0
    # work = 1.0 * 1.0 / 2.5 * 100 = 40.0
    # cafe = 0.5 * norm_cafe / 2.5 * 100 = 16.95
    assert perf.score_contributions.metro == 40.0
    assert perf.score_contributions.work_distance == 40.0
    assert perf.score_contributions.cafe == 16.95
    assert perf.total_score == 96.95
    assert (
        perf.score_contributions.metro
        + perf.score_contributions.work_distance
        + perf.score_contributions.cafe
        == perf.total_score
    )

    # miss contrib:
    # metro is None, so score_contributions.metro is None
    # active weights = 1.0 (work) + 0.5 (cafe) = 1.5
    # work = 1.0 * 1.0 / 1.5 * 100 = 66.67
    # cafe = 0.5 * norm_cafe(0.8474) / 1.5 * 100 = 28.25
    # sum = 94.92
    assert miss.score_contributions.metro is None
    assert miss.score_contributions.work_distance == 66.67
    assert miss.score_contributions.cafe == 28.25
    assert miss.total_score == 94.92
    assert (
        miss.score_contributions.work_distance + miss.score_contributions.cafe == miss.total_score
    )


def test_forced_inclusion_beyond_max_distance() -> None:
    prefs = RecommendationPreferences(
        metro_access_weight=1.0,
        short_commute_weight=1.0,
    )
    constraints = RecommendationConstraints(max_work_distance_km=10.0)

    c_close = CandidateLocality(
        id=1,
        slug="close",
        name="Close",
        lat=12.0,
        lng=77.0,
        metro_distance_m=0.0,
        metro_confidence="high",
        work_distance_km=5.0,
    )
    c_far = CandidateLocality(
        id=2,
        slug="far",
        name="Far",
        lat=12.0,
        lng=77.0,
        metro_distance_m=0.0,
        metro_confidence="high",
        work_distance_km=20.0,
    )

    # 1. Ordinary candidate beyond max_work_distance_km remains excluded
    # 7. no include_locality_ids preserves existing behavior
    results_normal, _ = rank_candidates([c_close, c_far], constraints, prefs, limit=10)
    assert len(results_normal) == 1
    assert results_normal[0].locality_id == 1

    # 2. explicitly included candidate beyond max_work_distance_km is returned
    results_included, _ = rank_candidates(
        [c_close, c_far], constraints, prefs, limit=10, include_locality_ids=[2]
    )
    assert len(results_included) == 2
    assert results_included[0].locality_id == 1  # Normal candidate still first
    assert results_included[1].locality_id == 2  # Forced inclusion appended

    # 3. included candidate retains its real work_distance_km
    assert results_included[1].raw_metrics.work_distance_km == 20.0

    # 4. included candidate is scored using the current request (20km => 0.0 work distance score)
    assert results_included[1].component_scores.work_distance == 0.0


def test_forced_inclusion_ordering_and_deduplication() -> None:
    prefs = RecommendationPreferences(
        metro_access_weight=1.0,
        short_commute_weight=1.0,
    )
    constraints = RecommendationConstraints()

    c1 = CandidateLocality(
        id=1,
        slug="c1",
        name="C1",
        lat=12.0,
        lng=77.0,
        work_distance_km=1.0,
        metro_distance_m=0.0,
        metro_confidence="high",
    )
    c2 = CandidateLocality(
        id=2,
        slug="c2",
        name="C2",
        lat=12.0,
        lng=77.0,
        work_distance_km=2.0,
        metro_distance_m=0.0,
        metro_confidence="high",
    )
    c3 = CandidateLocality(
        id=3,
        slug="c3",
        name="C3",
        lat=12.0,
        lng=77.0,
        work_distance_km=3.0,
        metro_distance_m=0.0,
        metro_confidence="high",
    )
    c4 = CandidateLocality(
        id=4,
        slug="c4",
        name="C4",
        lat=12.0,
        lng=77.0,
        work_distance_km=4.0,
        metro_distance_m=0.0,
        metro_confidence="high",
    )

    # 5. included candidate does not alter normal candidate filtering
    # 6. included candidate already in top-N is not duplicated
    results, _ = rank_candidates(
        [c1, c2, c3, c4],
        constraints,
        prefs,
        limit=2,
        include_locality_ids=[2, 4, 4, 999],  # Test duplicates and nonexistent
    )

    # Normal top 2 would be c1, c2
    # c2 is already in top 2 (not duplicated)
    # c4 is outside top 2 (appended)
    # 999 doesn't exist
    assert len(results) == 3
    assert results[0].locality_id == 1
    assert results[0].rank == 1
    assert results[1].locality_id == 2
    assert results[1].rank == 2
    assert results[2].locality_id == 4
    assert results[2].rank == 3


def test_recommendation_request_include_locality_ids_limits() -> None:
    import pytest
    from pydantic import ValidationError

    from app.schemas.recommendation import RecommendationRequest, WorkLocation

    base_kwargs = {
        "work_location": WorkLocation(lat=12.0, lng=77.0),
        "limit": 10,
    }

    # 1. include_locality_ids with 50 IDs -> accepted
    req_50 = RecommendationRequest(**base_kwargs, include_locality_ids=list(range(50)))
    assert len(req_50.include_locality_ids) == 50

    # 2. include_locality_ids with 51 IDs -> rejected by request validation
    with pytest.raises(ValidationError) as exc_info:
        RecommendationRequest(**base_kwargs, include_locality_ids=list(range(51)))
    assert "List should have at most 50 items" in str(exc_info.value)

    # 3. Empty list -> accepted
    req_empty = RecommendationRequest(**base_kwargs, include_locality_ids=[])
    assert len(req_empty.include_locality_ids) == 0

    # 4. Existing recommendation request behavior remains unchanged (default is empty list)
    req_default = RecommendationRequest(**base_kwargs)
    assert req_default.include_locality_ids == []


def test_missing_data_semantics_explicitly() -> None:
    c_case_a = CandidateLocality(
        id=1, slug="a", name="A", lat=12.0, lng=77.0,
        work_distance_km=2.0, # norm 1.0
        metro_distance_m=500.0, metro_confidence="high", # norm 1.0
        cafe_count=59.0, cafe_confidence="high", # norm 1.0
    )
    c_case_b = CandidateLocality(
        id=2, slug="b", name="B", lat=12.0, lng=77.0,
        work_distance_km=2.0, # norm 1.0
        metro_distance_m=None, metro_confidence=None, # norm None (missing)
        cafe_count=59.0, cafe_confidence="high", # norm 1.0
    )
    c_case_c = CandidateLocality(
        id=3, slug="c", name="C", lat=12.0, lng=77.0,
        work_distance_km=2.0, # norm 1.0
        metro_distance_m=3000.0, metro_confidence="high", # norm 0.0 (zero)
        cafe_count=59.0, cafe_confidence="high", # norm 1.0
    )
    c_case_d = CandidateLocality(
        id=4, slug="d", name="D", lat=12.0, lng=77.0,
        work_distance_km=20.0,  # norm 0.0 (force low to not mask other weights if w_work=0)
        metro_distance_m=None, metro_confidence=None, # missing
        cafe_count=None, cafe_confidence=None, # missing
    )

    constraints = RecommendationConstraints()
    prefs = RecommendationPreferences(
        short_commute_weight=1.0,
        metro_access_weight=1.0,
        cafe_weight=1.0,
        restaurant_weight=0.0,
        park_weight=0.0,
        healthcare_weight=0.0,
        nightlife_weight=0.0,
    )

    results, _ = rank_candidates(
        [c_case_a, c_case_b, c_case_c, c_case_d], constraints, prefs, limit=10
    )

    res_a = next(r for r in results if r.slug == "a")
    res_b = next(r for r in results if r.slug == "b")
    res_c = next(r for r in results if r.slug == "c")

    # Case A: all selected metrics available (1+1+1) / 3 = 1.0 => 100
    assert res_a.total_score == 100.0

    # Case B: one selected metric missing. Metro is None. Denominator is 2. (1+1)/2 = 1.0 => 100
    assert res_b.total_score == 100.0

    # Case C: one metric zero. Metro=0.0. Denominator=3. (1+0+1)/3 = 0.666 => 66.67
    assert res_c.total_score == 66.67

    # Case D: all weighted metrics missing.
    # To test this, we pass a preference where all non-None metrics have weight 0.0.
    # The only metric that is always not None is work_distance. We set short_commute_weight = 0.0.
    # Other metrics are None.
    prefs_all_missing = RecommendationPreferences(
        short_commute_weight=0.0,
        metro_access_weight=1.0,
        cafe_weight=1.0,
    )
    results_d, _ = rank_candidates([c_case_d], constraints, prefs_all_missing, limit=10)
    res_d = results_d[0]
    # Existing intended behavior when total_selected_weights <= 0 is to return 0.0
    assert res_d.total_score == 0.0


def test_budget_filtering() -> None:
    from app.models.observations import HousingConfiguration

    # Common metrics so they score equally and only budget matters
    def make_candidate(
        id: int, slug: str, rent_min: int | None, rent_conf: str | None = "high"
    ) -> CandidateLocality:
        return CandidateLocality(
            id=id, slug=slug, name=slug.capitalize(), lat=12.0, lng=77.0,
            work_distance_km=2.0, metro_distance_m=500.0, metro_confidence="high",
            rent_min_inr=rent_min, rent_max_inr=rent_min, rent_confidence=rent_conf
        )

    c_under = make_candidate(1, "under", 20000)
    c_exact = make_candidate(2, "exact", 25000)
    c_over = make_candidate(3, "over", 25001)
    c_unknown = make_candidate(4, "unknown", None, None)
    c_insufficient = make_candidate(5, "insufficient", 30000, "insufficient") # Unknown effectively

    all_candidates = [c_under, c_exact, c_over, c_unknown, c_insufficient]
    prefs = RecommendationPreferences()

    # A. No budget
    constraints_no_budget = RecommendationConstraints()
    res_no_budget, _ = rank_candidates(all_candidates, constraints_no_budget, prefs, limit=10)
    assert len(res_no_budget) == 5

    # F. Mixed candidates with budget 25000
    constraints_budget = RecommendationConstraints(
        max_budget_inr=25000, bhk_type=HousingConfiguration.BHK_2
    )
    res_budget, _ = rank_candidates(all_candidates, constraints_budget, prefs, limit=10)
    returned_slugs = {r.slug for r in res_budget}
    # B. Under budget remains
    assert "under" in returned_slugs
    # C. Exact budget boundary remains
    assert "exact" in returned_slugs
    # D. Over budget is excluded
    assert "over" not in returned_slugs
    # E. Unknown rent remains
    assert "unknown" in returned_slugs
    assert "insufficient" in returned_slugs

    # Verify only the over-budget candidate is removed
    assert len(res_budget) == 4
    # G. BHK specificity
    # The database populates CandidateLocality with the rent for the specific BHK.
    # We simulate this by passing the same candidates but changing the requested BHK.
    # The service layer only looks at rent_min_inr, so it naturally uses the specific BHK's rent.
    constraints_budget_bhk3 = RecommendationConstraints(
        max_budget_inr=25000, bhk_type=HousingConfiguration.BHK_3
    )
    res_bhk3, _ = rank_candidates(all_candidates, constraints_budget_bhk3, prefs, limit=10)
    assert len(res_bhk3) == 4
