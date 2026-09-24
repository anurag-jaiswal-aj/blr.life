from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.session import get_db
from app.main import app
from app.models.locality import Locality
from app.models.observations import (
    HousingConfiguration,
    LocalityMetric,
    LocalityRentObservation,
    MetricConfidence,
    MetricType,
)
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
async def setup_locality_data(async_db_session: AsyncSession):
    l1 = Locality(
        name="A Locality",
        slug="a-locality",
        parent_zone="Zone A",
        is_active=True,
        centroid="SRID=4326;POINT(77.5946 12.9716)",
    )
    l2 = Locality(
        name="B Locality",
        slug="b-locality",
        parent_zone="Zone B",
        is_active=True,
        centroid="SRID=4326;POINT(77.65 13.0)",
    )
    l_inactive = Locality(
        name="C Locality",
        slug="c-locality",
        is_active=False,
        centroid="SRID=4326;POINT(77.65 13.0)",
    )
    l_poly = Locality(
        name="Poly Locality",
        slug="poly-locality",
        is_active=True,
        centroid="SRID=4326;POINT(77.6 13.0)",
        geometry="SRID=4326;MULTIPOLYGON(((77.5 12.9, 77.6 12.9, "
        "77.6 13.0, 77.5 13.0, 77.5 12.9)))",
    )
    async_db_session.add_all([l1, l2, l_inactive, l_poly])
    await async_db_session.flush()

    # Add metrics for A
    metrics = [
        LocalityMetric(
            locality_id=l1.id,
            metric_type=MetricType.METRO_DISTANCE_M,
            value=1200.0,
            calc_version="v1",
            calculated_at=datetime.now(UTC),
            confidence=MetricConfidence.HIGH,
            is_current=True,
            extra_data={"nearest_station_name": "MG Road", "nearest_station_line": "Purple"},
        ),
        LocalityMetric(
            locality_id=l1.id,
            metric_type=MetricType.CAFE_ACCESSIBILITY,
            value=11.0,
            calc_version="v1",
            calculated_at=datetime.now(UTC),
            confidence=MetricConfidence.MEDIUM,
            is_current=True,
        ),
        LocalityMetric(
            locality_id=l1.id,
            metric_type=MetricType.RESTAURANT_ACCESSIBILITY,
            value=22.0,
            calc_version="v1",
            calculated_at=datetime.now(UTC),
            confidence=MetricConfidence.MEDIUM,
            is_current=True,
        ),
        LocalityMetric(
            locality_id=l1.id,
            metric_type=MetricType.PARK_ACCESSIBILITY,
            value=33.0,
            calc_version="v1",
            calculated_at=datetime.now(UTC),
            confidence=MetricConfidence.MEDIUM,
            is_current=True,
        ),
        LocalityMetric(
            locality_id=l1.id,
            metric_type=MetricType.HEALTHCARE_ACCESSIBILITY,
            value=44.0,
            calc_version="v1",
            calculated_at=datetime.now(UTC),
            confidence=MetricConfidence.MEDIUM,
            is_current=True,
        ),
        LocalityMetric(
            locality_id=l1.id,
            metric_type=MetricType.NIGHTLIFE_ACCESSIBILITY,
            value=55.0,
            calc_version="v1",
            calculated_at=datetime.now(UTC),
            confidence=MetricConfidence.MEDIUM,
            is_current=True,
        ),
    ]
    async_db_session.add_all(metrics)

    # Add MULTIPLE current rent configurations for A (e.g. 1BHK and 2BHK)
    rent_1 = LocalityRentObservation(
        locality_id=l1.id,
        housing_config=HousingConfiguration.BHK_1,
        rent_min_inr=15000,
        rent_max_inr=20000,
        confidence=MetricConfidence.MEDIUM,
        is_current=True,
    )
    rent_2 = LocalityRentObservation(
        locality_id=l1.id,
        housing_config=HousingConfiguration.BHK_2,
        rent_min_inr=25000,
        rent_max_inr=30000,
        confidence=MetricConfidence.MEDIUM,
        is_current=True,
    )
    async_db_session.add_all([rent_1, rent_2])

    # Add a SINGLE rent configuration for B
    rent_b = LocalityRentObservation(
        locality_id=l2.id,
        housing_config=HousingConfiguration.BHK_2,
        rent_min_inr=29500,
        rent_max_inr=43000,
        confidence=MetricConfidence.HIGH,
        is_current=True,
    )
    async_db_session.add(rent_b)

    await async_db_session.commit()


@pytest.mark.asyncio
async def test_list_localities(async_client: AsyncClient, setup_locality_data):
    response = await async_client.get("/api/v1/localities")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3  # Only active ones
    assert data[0]["name"] == "A Locality"
    assert data[1]["name"] == "B Locality"
    assert data[2]["name"] == "Poly Locality"
    assert data[0]["slug"] == "a-locality"
    assert data[0]["parent_zone"] == "Zone A"


@pytest.mark.asyncio
async def test_get_locality_detail(async_client: AsyncClient, setup_locality_data):
    response = await async_client.get("/api/v1/localities/a-locality")
    assert response.status_code == 200
    data = response.json()

    assert data["name"] == "A Locality"
    assert data["slug"] == "a-locality"
    assert data["parent_zone"] == "Zone A"
    assert data["centroid"]["lat"] == 12.9716
    assert data["centroid"]["lng"] == 77.5946
    assert data.get("geometry_geojson") is None

    # Test poly locality
    response_poly = await async_client.get("/api/v1/localities/poly-locality")
    assert response_poly.status_code == 200
    data_poly = response_poly.json()
    assert data_poly["geometry_geojson"] is not None
    assert data_poly["geometry_geojson"]["type"] == "MultiPolygon"
    assert len(data_poly["geometry_geojson"]["coordinates"]) == 1

    assert data["metro"]["station_name"] == "MG Road"
    assert data["metro"]["line"] == "Purple"
    assert data["metro"]["distance_m"] == 1200.0

    assert data["amenities"]["cafes"] == 11.0
    assert data["amenities"]["restaurants"] == 22.0
    assert data["amenities"]["parks"] == 33.0
    assert data["amenities"]["healthcare"] == 44.0
    assert data["amenities"]["nightlife"] == 55.0

    # Since A has BOTH 1BHK and 2BHK rents, it should be None
    # (ambiguous/multiple current configurations)
    assert data["rent"] is None


@pytest.mark.asyncio
async def test_get_locality_detail_single_rent(async_client: AsyncClient, setup_locality_data):
    response = await async_client.get("/api/v1/localities/b-locality")
    assert response.status_code == 200
    data = response.json()

    assert data["name"] == "B Locality"
    # B has only ONE current configuration (2BHK), so it should return rent
    assert data["rent"]["min_inr"] == 29500
    assert data["rent"]["max_inr"] == 43000
    assert data["rent"]["confidence"] == "high"
    assert data["metro"] is None


@pytest.mark.asyncio
async def test_get_locality_detail_not_found(async_client: AsyncClient, setup_locality_data):
    response = await async_client.get("/api/v1/localities/unknown-slug")
    assert response.status_code == 404

    response = await async_client.get("/api/v1/localities/c-locality")  # inactive
    assert response.status_code == 404
