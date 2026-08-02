import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ingestion.metro_models import IngestMetroPayload, IngestMetroStation
from app.ingestion.metro_pipeline import calculate_metro_metrics, run_metro_ingestion
from app.models.observations import LocalityMetric, MetricType
from tests.integration.test_domain_integration import TEST_ASYNC_URL


@pytest_asyncio.fixture
async def async_db_session():
    engine = create_async_engine(TEST_ASYNC_URL, echo=False)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.connect() as conn:
        await conn.begin_nested()
        async with async_session_factory(bind=conn) as session:
            yield session
        await conn.rollback()

    await engine.dispose()


@pytest.mark.asyncio
async def test_metro_ingestion_and_calculation(async_db_session):
    # 1. Setup a test locality
    # We insert a source, snapshot, and locality manually
    await async_db_session.execute(
        text(
            "INSERT INTO data_source (key, display_name) "
            "VALUES ('test_source', 'Test Source') ON CONFLICT DO NOTHING"
        )
    )
    ds_id = (
        await async_db_session.execute(text("SELECT id FROM data_source WHERE key='test_source'"))
    ).scalar_one()
    await async_db_session.execute(
        text(f"INSERT INTO dataset_snapshot (data_source_id, retrieved_at) VALUES ({ds_id}, now())")
    )
    snap_id = (
        await async_db_session.execute(
            text("SELECT id FROM dataset_snapshot ORDER BY id DESC LIMIT 1")
        )
    ).scalar_one()

    # Locality near Indiranagar
    await async_db_session.execute(
        text(
            f"""
            INSERT INTO locality (name, slug, geometry, centroid, geometry_snapshot_id, is_active)
            VALUES ('Indiranagar', 'indiranagar', 
                    ST_GeomFromEWKT('SRID=4326;POLYGON((77.635 12.975, 77.645 12.975, '
                                    '77.645 12.985, 77.635 12.985, 77.635 12.975))'), 
                    ST_GeomFromEWKT('SRID=4326;POINT(77.640 12.980)'),
                    {snap_id}, true)
            """
        )
    )  # 2. Ingest Metro Station
    payload = IngestMetroPayload(
        source_key="blr_life_curated_metro_stations",
        source_version="v1.0",
        data_retrieved_at="2025-01-01T00:00:00Z",
        stations=[
            IngestMetroStation(
                name="Indiranagar",
                slug="indiranagar-metro",
                osm_id="node/12345",
                latitude=12.978,  # Close to the centroid (12.980, 77.640)
                longitude=77.638,
            )
        ],
    )

    stats = await run_metro_ingestion(async_db_session, payload, dry_run=False)
    assert stats["created"] == 1
    assert stats["updated"] == 0

    # Test idempotency
    stats = await run_metro_ingestion(async_db_session, payload, dry_run=False)
    assert stats["created"] == 0
    assert stats["updated"] == 0
    assert stats["unchanged"] == 1

    # 3. Calculate Metrics
    calc_stats = await calculate_metro_metrics(
        async_db_session, dry_run=False, calc_version="test-calc"
    )
    assert calc_stats["created"] == 1

    # Idempotency for metrics
    calc_stats2 = await calculate_metro_metrics(
        async_db_session, dry_run=False, calc_version="test-calc"
    )
    assert calc_stats2["created"] == 0
    assert calc_stats2["unchanged"] == 1

    # 4. Verify Metric in Database
    loc_id = (
        await async_db_session.execute(text("SELECT id FROM locality WHERE slug='indiranagar'"))
    ).scalar_one()
    metric = (
        await async_db_session.execute(
            select(LocalityMetric).where(LocalityMetric.locality_id == loc_id)
        )
    ).scalar_one()

    assert metric.metric_type == MetricType.METRO_DISTANCE_M
    # Expect distance to be ~300 meters (0.002 degrees lat, 0.002 degrees lon away)
    assert 200 < metric.value < 500
    assert metric.extra_data["nearest_station_slug"] == "indiranagar-metro"
