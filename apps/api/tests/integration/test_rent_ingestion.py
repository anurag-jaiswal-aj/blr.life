import json
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ingestion.rent_pipeline import run_rent_ingestion
from app.models.locality import Locality
from app.models.observations import HousingConfiguration, LocalityRentObservation, MetricConfidence
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


@pytest.fixture
def rent_json_file(tmp_path: Path) -> str:
    data = {
        "dataset_version": "1.0",
        "methodology": "Test curation",
        "observations": [
            {
                "locality_slug": "test-loc-1",
                "bhk": "1bhk",
                "rent_min_inr": 15000,
                "rent_max_inr": 25000,
                "confidence": "low",
            },
            {
                "locality_slug": "test-loc-1",
                "bhk": "2bhk",
                "rent_min_inr": 25000,
                "rent_max_inr": 35000,
                "confidence": "low",
            },
        ],
    }
    file_path = tmp_path / "rent.json"
    with open(file_path, "w") as f:
        json.dump(data, f)
    return str(file_path)


@pytest.mark.asyncio
async def test_rent_ingestion_success(async_db_session: AsyncSession, rent_json_file: str) -> None:
    # 1. Setup active locality
    loc = Locality(
        name="Test Locality 1",
        slug="test-loc-1",
        parent_zone="South",
        is_active=True,
        centroid="SRID=4326;POINT(77.5 12.9)",
        geometry_source="osm_point",
        geometry_confidence="low",
    )
    async_db_session.add(loc)
    await async_db_session.commit()

    # 2. Run Ingestion
    stats = await run_rent_ingestion(async_db_session, rent_json_file)
    assert stats["created"] == 2
    assert stats["deactivated"] == 0
    assert stats["unchanged"] == 0

    # 3. Verify DB
    stmt = select(LocalityRentObservation).where(
        LocalityRentObservation.locality_id == loc.id, LocalityRentObservation.is_current.is_(True)
    )
    result = await async_db_session.execute(stmt)
    observations = result.scalars().all()
    assert len(observations) == 2

    obs_1bhk = next(o for o in observations if o.housing_config == HousingConfiguration.BHK_1)
    assert obs_1bhk.rent_min_inr == 15000
    assert obs_1bhk.rent_max_inr == 25000

    # 4. Run idempotent ingestion
    stats2 = await run_rent_ingestion(async_db_session, rent_json_file)
    assert stats2["created"] == 0
    assert stats2["unchanged"] == 2


@pytest.mark.asyncio
async def test_rent_ingestion_stale_deactivation(
    async_db_session: AsyncSession, tmp_path: Path
) -> None:
    # Setup active locality
    loc = Locality(
        name="Test Locality 1",
        slug="test-loc-1",
        parent_zone="South",
        is_active=True,
        centroid="SRID=4326;POINT(77.5 12.9)",
        geometry_source="osm_point",
        geometry_confidence="low",
    )
    async_db_session.add(loc)
    await async_db_session.commit()

    data = {
        "dataset_version": "1.0",
        "methodology": "Test curation",
        "observations": [
            {
                "locality_slug": "test-loc-1",
                "bhk": "1bhk",
                "rent_min_inr": 15000,
                "rent_max_inr": 25000,
                "confidence": "low",
            },
            {
                "locality_slug": "test-loc-1",
                "bhk": "2bhk",
                "rent_min_inr": 25000,
                "rent_max_inr": 35000,
                "confidence": "low",
            },
        ],
    }
    file1 = tmp_path / "rent1.json"
    with open(file1, "w") as f:
        json.dump(data, f)

    await run_rent_ingestion(async_db_session, str(file1))

    # Now remove 2BHK from new JSON
    data2 = {
        "dataset_version": "2.0",
        "methodology": "Test curation v2",
        "observations": [
            {
                "locality_slug": "test-loc-1",
                "bhk": "1bhk",
                "rent_min_inr": 15000,
                "rent_max_inr": 25000,
                "confidence": "low",
            }
        ],
    }
    file2 = tmp_path / "rent2.json"
    with open(file2, "w") as f:
        json.dump(data2, f)

    stats2 = await run_rent_ingestion(async_db_session, str(file2))
    assert stats2["created"] == 1
    assert stats2["deactivated"] == 2
    assert stats2["unchanged"] == 0

    # Verify DB
    stmt = select(LocalityRentObservation).where(
        LocalityRentObservation.locality_id == loc.id, LocalityRentObservation.is_current.is_(True)
    )
    result = await async_db_session.execute(stmt)
    observations = result.scalars().all()
    assert len(observations) == 1
    assert observations[0].housing_config == HousingConfiguration.BHK_1


@pytest.mark.asyncio
async def test_rent_ingestion_ownership_isolation(
    async_db_session: AsyncSession, tmp_path: Path
) -> None:
    from app.models.provenance import DatasetSnapshot, DataSource, SnapshotStatus

    # 1. Setup active locality
    loc = Locality(
        name="Test Locality Isolated",
        slug="test-loc-isolated",
        parent_zone="South",
        is_active=True,
        centroid="SRID=4326;POINT(77.5 12.9)",
        geometry_source="osm_point",
        geometry_confidence="low",
    )
    async_db_session.add(loc)
    await async_db_session.commit()

    # 2. Setup unrelated data source & snapshot
    other_source = DataSource(
        key="other_source",
        display_name="Other Source",
    )
    async_db_session.add(other_source)
    await async_db_session.flush()

    other_snapshot = DatasetSnapshot(
        data_source_id=other_source.id,
        status=SnapshotStatus.COMPLETED,
        retrieved_at=func.now(),
    )
    async_db_session.add(other_snapshot)
    await async_db_session.flush()

    # 3. Setup Canonical data source & snapshot (so we can test canonical stale cleanup)
    canonical_source = DataSource(
        key="blr_life_curated_rent",
        display_name="Curated Rent Affordability Bands",
    )
    async_db_session.add(canonical_source)
    await async_db_session.flush()

    canonical_snapshot = DatasetSnapshot(
        data_source_id=canonical_source.id,
        status=SnapshotStatus.COMPLETED,
        retrieved_at=func.now(),
    )
    async_db_session.add(canonical_snapshot)
    await async_db_session.flush()

    # 4. Insert an unrelated current observation
    unrelated_obs = LocalityRentObservation(
        locality_id=loc.id,
        housing_config=HousingConfiguration.BHK_3,
        rent_min_inr=50000,
        rent_max_inr=60000,
        snapshot_id=other_snapshot.id,
        confidence=MetricConfidence.LOW,
        is_current=True,
    )
    async_db_session.add(unrelated_obs)

    # 5. Insert a canonical current observation (that should become stale)
    canonical_obs = LocalityRentObservation(
        locality_id=loc.id,
        housing_config=HousingConfiguration.BHK_1,
        rent_min_inr=15000,
        rent_max_inr=25000,
        snapshot_id=canonical_snapshot.id,
        confidence=MetricConfidence.LOW,
        is_current=True,
    )
    async_db_session.add(canonical_obs)
    await async_db_session.commit()

    # 6. Run ingestion with a file that has no 1BHK, but has 2BHK
    data = {
        "dataset_version": "1.0",
        "methodology": "Test curation",
        "observations": [
            {
                "locality_slug": "test-loc-isolated",
                "bhk": "2bhk",
                "rent_min_inr": 25000,
                "rent_max_inr": 35000,
                "confidence": "low",
            },
        ],
    }
    file1 = tmp_path / "rent_isolated.json"
    with open(file1, "w") as f:
        json.dump(data, f)

    stats = await run_rent_ingestion(async_db_session, str(file1))
    assert stats["created"] == 1
    assert stats["deactivated"] == 1
    assert stats["unchanged"] == 0

    # 7. Verify DB
    stmt = select(LocalityRentObservation).where(
        LocalityRentObservation.locality_id == loc.id, LocalityRentObservation.is_current.is_(True)
    )
    result = await async_db_session.execute(stmt)
    observations = result.scalars().all()
    assert len(observations) == 2

    configs = {o.housing_config for o in observations}
    assert HousingConfiguration.BHK_3 in configs  # Unrelated observation was PRESERVED
    assert HousingConfiguration.BHK_2 in configs  # New canonical observation was CREATED
    assert HousingConfiguration.BHK_1 not in configs  # Old canonical observation was DEACTIVATED
