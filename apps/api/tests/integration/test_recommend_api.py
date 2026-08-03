from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.session import get_db
from app.main import app
from app.models.locality import Locality
from app.models.observations import LocalityMetric, MetricConfidence, MetricType
from tests.integration.test_domain_integration import TEST_ASYNC_URL


@pytest_asyncio.fixture
async def async_db_session():
    engine = create_async_engine(TEST_ASYNC_URL, echo=False)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.connect() as conn:
        await conn.begin_nested()
        async with async_session_factory(bind=conn) as session:
            yield session
            await session.rollback()


@pytest_asyncio.fixture
async def async_client(async_db_session: AsyncSession):
    async def override_get_db():
        yield async_db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
async def setup_recommendation_data(async_db_session):
    l1 = Locality(
        name="Near Metro",
        slug="near-metro",
        is_active=True,
        centroid="SRID=4326;POINT(77.5946 12.9716)",
    )
    l2 = Locality(
        name="Far Area", slug="far-area", is_active=True, centroid="SRID=4326;POINT(77.65 13.0)"
    )
    l3 = Locality(
        name="No Metro Data",
        slug="no-metro",
        is_active=True,
        centroid="SRID=4326;POINT(77.60 12.98)",
    )

    async_db_session.add_all([l1, l2, l3])
    await async_db_session.flush()

    m1 = LocalityMetric(
        locality_id=l1.id,
        metric_type=MetricType.METRO_DISTANCE_M,
        value=500.0,
        calc_version="v1",
        calculated_at=datetime.now(UTC),
        confidence=MetricConfidence.HIGH,
        is_current=True,
    )
    m2 = LocalityMetric(
        locality_id=l2.id,
        metric_type=MetricType.METRO_DISTANCE_M,
        value=4000.0,
        calc_version="v1",
        calculated_at=datetime.now(UTC),
        confidence=MetricConfidence.HIGH,
        is_current=True,
    )
    async_db_session.add_all([m1, m2])
    await async_db_session.commit()
    return l1, l2, l3


@pytest.mark.asyncio
async def test_recommend_success_standard(async_client: AsyncClient, setup_recommendation_data):
    payload = {
        "work_location": {"lat": 12.9716, "lng": 77.5946},
        "constraints": {},
        "preferences": {"metro_access_weight": 1.0, "short_commute_weight": 1.0},
        "limit": 10,
    }
    response = await async_client.post("/api/v1/recommend", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "recommendations" in data
    assert "provenance" in data
    assert "v1" in data["provenance"]["calc_versions_used"]

    recs = data["recommendations"]
    assert len(recs) == 3
    assert recs[0]["slug"] == "near-metro"
    assert recs[0]["total_score"] == 100.0  # distance is 0, metro is 500
    assert recs[0]["rank"] == 1

    assert recs[1]["slug"] == "no-metro"
    assert recs[1]["component_scores"]["metro"] is None

    assert recs[2]["slug"] == "far-area"


@pytest.mark.asyncio
async def test_recommend_hard_constraint_work_distance(
    async_client: AsyncClient, setup_recommendation_data
):
    payload = {
        "work_location": {"lat": 12.9716, "lng": 77.5946},
        "constraints": {"max_work_distance_km": 2.0},
        "limit": 10,
    }
    response = await async_client.post("/api/v1/recommend", json=payload)
    assert response.status_code == 200
    data = response.json()
    recs = data["recommendations"]

    # far-area should be filtered out
    assert len(recs) == 2
    for r in recs:
        assert r["raw_metrics"]["work_distance_km"] <= 2.0


@pytest.mark.asyncio
async def test_unsupported_rent_constraint_rejected(
    async_client: AsyncClient, setup_recommendation_data
):
    payload = {
        "work_location": {"lat": 12.9716, "lng": 77.5946},
        "constraints": {"max_rent_inr": 25000},
        "limit": 10,
    }
    response = await async_client.post("/api/v1/recommend", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_recommend_validation_errors(async_client: AsyncClient):
    payload = {
        "work_location": {"lat": 100.0, "lng": 77.5946},  # Invalid lat
    }
    response = await async_client.post("/api/v1/recommend", json=payload)
    assert response.status_code == 422

    payload = {
        "work_location": {"lat": 12.9716, "lng": 77.5946},
        "preferences": {"metro_access_weight": 0.0, "short_commute_weight": 0.0},  # Zero weight
    }
    response = await async_client.post("/api/v1/recommend", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_recommend_amenities(
    async_client: AsyncClient, setup_recommendation_data, async_db_session: AsyncSession
):
    l1, _, _ = setup_recommendation_data

    # Add cafe metric
    m_cafe = LocalityMetric(
        locality_id=l1.id,
        metric_type=MetricType.CAFE_ACCESSIBILITY,
        value=15.0,
        calc_version="v1",
        calculated_at=datetime.now(UTC),
        confidence=MetricConfidence.HIGH,
        is_current=True,
    )
    async_db_session.add(m_cafe)
    await async_db_session.commit()

    payload = {
        "work_location": {"lat": 12.9716, "lng": 77.5946},
        "preferences": {
            "metro_access_weight": 1.0,
            "short_commute_weight": 1.0,
            "cafe_weight": 1.0,
        },
        "limit": 10,
    }
    response = await async_client.post("/api/v1/recommend", json=payload)
    assert response.status_code == 200
    data = response.json()

    recs = data["recommendations"]
    l1_rec = next(r for r in recs if r["slug"] == "near-metro")

    assert l1_rec["raw_metrics"]["cafe_accessibility"] == 15.0
    assert l1_rec["component_scores"]["cafe"] == 1.0
    assert "High cafe count within 1.5km (provisional)" in l1_rec["explanations"]["pros"]
