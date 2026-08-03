import json
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ingestion.amenity_pipeline import calculate_amenity_metrics, run_amenity_ingestion
from app.models.amenity import AmenityCategory, AmenityPOI
from app.models.locality import GeometryConfidence, GeometrySource, Locality
from app.models.observations import LocalityMetric, MetricType
from tests.integration.test_domain_integration import TEST_ASYNC_URL, setup_test_database as _setup_test_database


@pytest.fixture(autouse=True)
def _init_db(_setup_test_database):
    """Ensure database schema is created before tests in this file."""
    pass


@pytest_asyncio.fixture
async def async_db_session():
    """Provide an asynchronous DB session that rolls back after each test."""
    engine = create_async_engine(TEST_ASYNC_URL, echo=False)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.connect() as conn:
        await conn.begin_nested()  # savepoint
        async with async_session_factory(bind=conn) as session:
            yield session
        await conn.rollback()

    await engine.dispose()


@pytest.fixture
def mock_osm_data(tmp_path: Path) -> str:
    data = {
        "pois": [
            {
                "category": "cafe",
                "osm_id": "node/111",
                "name": "Test Cafe",
                "lat": 12.971598,
                "lon": 77.594562,
            },
            {
                "category": "park",
                "osm_id": "way/222",
                "name": "Test Park",
                "lat": 12.971600,
                "lon": 77.594600,
            },
        ]
    }
    file_path = tmp_path / "osm_data.json"
    with open(file_path, "w") as f:
        json.dump(data, f)
    return str(file_path)


@pytest.fixture
def mock_osm_data_update(tmp_path: Path) -> str:
    data = {
        "pois": [
            {
                "category": "restaurant",  # category changed
                "osm_id": "node/111",
                "name": "Test Cafe Updated",  # name changed
                "lat": 12.971598,
                "lon": 77.594562,
            },
            # way/222 is omitted, so it should become stale
        ]
    }
    file_path = tmp_path / "osm_data_update.json"
    with open(file_path, "w") as f:
        json.dump(data, f)
    return str(file_path)


@pytest.fixture
async def sample_locality(async_db_session: AsyncSession) -> Locality:
    loc = Locality(
        name="Test Locality",
        slug="test-locality",
        parent_zone="Central",
        is_active=True,
        centroid=func.ST_GeomFromEWKT("SRID=4326;POINT(77.594562 12.971598)"),
        geometry_source=GeometrySource.OSM_POINT,
        geometry_confidence=GeometryConfidence.MEDIUM,
    )
    async_db_session.add(loc)
    await async_db_session.flush()
    return loc


@pytest.mark.asyncio
async def test_amenity_ingestion_pipeline(
    async_db_session: AsyncSession,
    mock_osm_data: str,
    mock_osm_data_update: str,
    sample_locality: Locality,
) -> None:
    # 1. First import
    stats = await run_amenity_ingestion(async_db_session, mock_osm_data)
    assert stats["created"] == 2
    assert stats["updated"] == 0
    assert stats["deactivated"] == 0

    pois = (await async_db_session.execute(select(AmenityPOI))).scalars().all()
    assert len(pois) == 2
    assert all(p.is_active for p in pois)

    # 2. Duplicate prevention (Second identical import)
    stats2 = await run_amenity_ingestion(async_db_session, mock_osm_data)
    assert stats2["created"] == 0
    assert stats2["updated"] == 0
    assert stats2["unchanged"] == 2

    pois_after_dup = (await async_db_session.execute(select(AmenityPOI))).scalars().all()
    assert len(pois_after_dup) == 2

    # Verify POI IDs remained completely stable
    assert {p.id for p in pois} == {p.id for p in pois_after_dup}

    # 3. Single record update and Stale Reconciliation
    stats3 = await run_amenity_ingestion(async_db_session, mock_osm_data_update)
    assert stats3["created"] == 0
    assert stats3["updated"] == 1
    assert stats3["deactivated"] == 1

    pois_updated_list = (await async_db_session.execute(select(AmenityPOI))).scalars().all()
    pois_updated = {p.osm_id: p for p in pois_updated_list}

    # ID stability and update verification
    node_111 = pois_updated["node/111"]
    assert node_111.name == "Test Cafe Updated"
    assert node_111.category == AmenityCategory.RESTAURANT
    assert node_111.is_active is True

    way_222 = pois_updated["way/222"]
    assert way_222.is_active is False

    # 4. Metric First Run
    calc_stats = await calculate_amenity_metrics(async_db_session)
    assert calc_stats["created"] == 5  # 5 categories * 1 locality
    assert calc_stats["updated"] == 0

    metrics_list = (await async_db_session.execute(select(LocalityMetric))).scalars().all()
    metrics = {m.metric_type: m for m in metrics_list}
    assert metrics[MetricType.RESTAURANT_ACCESSIBILITY].value == 1
    assert metrics[MetricType.PARK_ACCESSIBILITY].value == 0

    # 5. Metric Idempotency (Second run)
    calc_stats2 = await calculate_amenity_metrics(async_db_session)
    assert calc_stats2["created"] == 0
    assert calc_stats2["updated"] == 0
    assert calc_stats2["unchanged"] == 5

    # 6. Dry Run Safety
    calc_stats_dry = await calculate_amenity_metrics(async_db_session, dry_run=True)
    # The stats will say "unchanged", but DB is untouched because of rollback
    assert calc_stats_dry["unchanged"] == 5
