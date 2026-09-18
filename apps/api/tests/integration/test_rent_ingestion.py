from .test_domain_integration import setup_test_database

import json
import os

# We need to import the functions from the script, but since it's a script
# we can import it this way:
import sys
import tempfile

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.locality import Locality
from app.models.observations import HousingConfiguration, LocalityRentObservation, MetricConfidence

sys.path.append(os.path.join(os.path.dirname(__file__), "../../../scripts"))
try:
    from scripts.ingest_rent import run_ingestion
except ImportError:
    # If ran from another cwd
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scripts")))
    from ingest_rent import run_ingestion


from tests.integration.test_domain_integration import TEST_ASYNC_URL


@pytest_asyncio.fixture
async def async_db_session(setup_test_database):
    # Use the test engine URL
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    engine = create_async_engine(TEST_ASYNC_URL, echo=False)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.connect() as conn:
        await conn.begin_nested()
        async with async_session_factory(bind=conn) as session:
            # Setup locality
            loc = Locality(
                slug="whitefield",
                name="Whitefield",
                is_active=True,
                centroid="POINT(77.7 12.9)"
            )
            session.add(loc)
            await session.commit()
            yield session
            await session.rollback()

class DummyFactory:
    def __init__(self, session):
        self.session = session
    def __call__(self):
        return self
    async def __aenter__(self):
        return self.session
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

@pytest.fixture
def base_valid_data():
    return {
        "dataset_version": "1.0",
        "created_at": "2026-08-01T00:00:00Z",
        "methodology": "Test",
        "confidence_methodology": "Test",
        "observation_count": 1,
        "observations": [
            {
                "locality_slug": "whitefield",
                "bhk": "2bhk",
                "rent_min_inr": 20000,
                "rent_max_inr": 30000,
                "confidence": "high",
                "provenance": {
                    "publisher": "TestPub",
                    "source_title": "TestTitle",
                    "source_url": None,
                    "published_at": None,
                    "accessed_at": "2026-08-01T00:00:00Z",
                    "source_type": "test",
                    "sample_count": None,
                    "derivation": "test"
                }
            }
        ]
    }


@pytest.fixture
def temp_json_file():
    fd, path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    yield path
    os.remove(path)


@pytest.mark.asyncio
async def test_ingest_dry_run(base_valid_data, temp_json_file, async_db_session):
    with open(temp_json_file, "w") as f:
        json.dump(base_valid_data, f)

    # Check current state
    result = await async_db_session.execute(select(LocalityRentObservation))
    initial_count = len(result.scalars().all())

    await run_ingestion(
        temp_json_file, dry_run=True, session_factory=DummyFactory(async_db_session)
    )

    # State should remain the same
    result = await async_db_session.execute(select(LocalityRentObservation))
    final_count = len(result.scalars().all())
    assert final_count == initial_count


@pytest.mark.asyncio
async def test_ingest_successful_transaction(base_valid_data, temp_json_file, async_db_session):
    with open(temp_json_file, "w") as f:
        json.dump(base_valid_data, f)

    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )

    # Verify observation
    obs = (await async_db_session.execute(
        select(LocalityRentObservation).where(LocalityRentObservation.is_current == True)
        .order_by(LocalityRentObservation.id.desc())
    )).scalars().first()

    assert obs is not None
    assert obs.rent_min_inr == 20000
    assert obs.rent_max_inr == 30000
    assert obs.housing_config == HousingConfiguration.BHK_2
    assert obs.confidence == MetricConfidence.HIGH


@pytest.mark.asyncio
async def test_ingest_idempotency(base_valid_data, temp_json_file, async_db_session):
    with open(temp_json_file, "w") as f:
        json.dump(base_valid_data, f)

    # First run
    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )
    res1 = await async_db_session.execute(select(LocalityRentObservation))
    obs_count_1 = len(res1.scalars().all())

    # Second run
    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )
    res2 = await async_db_session.execute(select(LocalityRentObservation))
    obs_count_2 = len(res2.scalars().all())

    # Should skip exact duplicates
    assert obs_count_1 == obs_count_2


@pytest.mark.asyncio
async def test_ingest_deprecates_previous(base_valid_data, temp_json_file, async_db_session):
    with open(temp_json_file, "w") as f:
        json.dump(base_valid_data, f)
    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )

    # New file with newer data
    new_data = base_valid_data.copy()
    new_data["dataset_version"] = "1.1"
    new_data["observations"][0]["rent_min_inr"] = 25000
    new_data["observations"][0]["rent_max_inr"] = 35000

    with open(temp_json_file, "w") as f:
        json.dump(new_data, f)

    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )

    obs = (await async_db_session.execute(
        select(LocalityRentObservation)
        .where(
            LocalityRentObservation.housing_config == "2bhk",
            LocalityRentObservation.is_current == True
        )
    )).scalars().all()

    # Only 1 should be current
    assert len(obs) == 1
    assert obs[0].rent_min_inr == 25000

    # Verify deprecated exists
    deprecated = (await async_db_session.execute(
        select(LocalityRentObservation)
        .where(
            LocalityRentObservation.housing_config == "2bhk",
            LocalityRentObservation.is_current == False,
            LocalityRentObservation.rent_min_inr == 20000
        )
    )).scalars().first()
    assert deprecated is not None


@pytest.mark.asyncio
async def test_ingest_quality_protection(base_valid_data, temp_json_file, async_db_session):
    # Insert HIGH
    with open(temp_json_file, "w") as f:
        json.dump(base_valid_data, f)
    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )

    # Try inserting LOW
    low_data = base_valid_data.copy()
    low_data["dataset_version"] = "1.2"
    low_data["observations"][0]["confidence"] = "low"
    low_data["observations"][0]["rent_min_inr"] = 10000

    with open(temp_json_file, "w") as f:
        json.dump(low_data, f)

    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )

    obs = (await async_db_session.execute(
        select(LocalityRentObservation)
        .where(LocalityRentObservation.is_current == True)
        .order_by(LocalityRentObservation.id.desc())
    )).scalars().first()

    # Should remain HIGH, and rent_min 20000
    assert obs.confidence == MetricConfidence.HIGH
    assert obs.rent_min_inr == 20000


@pytest.mark.asyncio
async def test_ingest_invalid_locality(base_valid_data, temp_json_file, async_db_session):
    base_valid_data["observations"][0]["locality_slug"] = "nonexistent-locality"
    with open(temp_json_file, "w") as f:
        json.dump(base_valid_data, f)

    result = await async_db_session.execute(select(LocalityRentObservation))
    initial_count = len(result.scalars().all())
    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )
    result = await async_db_session.execute(select(LocalityRentObservation))
    final_count = len(result.scalars().all())

    # Should not insert anything
    assert initial_count == final_count


@pytest.mark.asyncio
async def test_ingest_invalid_rent_range(base_valid_data, temp_json_file, async_db_session):
    base_valid_data["observations"][0]["rent_min_inr"] = 40000
    base_valid_data["observations"][0]["rent_max_inr"] = 30000
    with open(temp_json_file, "w") as f:
        json.dump(base_valid_data, f)

    result = await async_db_session.execute(select(LocalityRentObservation))
    initial_count = len(result.scalars().all())
    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )
    result = await async_db_session.execute(select(LocalityRentObservation))
    final_count = len(result.scalars().all())

    assert initial_count == final_count


@pytest.mark.asyncio
async def test_ingest_missing_rent_boundaries(base_valid_data, temp_json_file, async_db_session):
    base_valid_data["observations"][0]["rent_min_inr"] = None
    base_valid_data["observations"][0]["rent_max_inr"] = None
    with open(temp_json_file, "w") as f:
        json.dump(base_valid_data, f)

    result = await async_db_session.execute(select(LocalityRentObservation))
    initial_count = len(result.scalars().all())
    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )
    result = await async_db_session.execute(select(LocalityRentObservation))
    final_count = len(result.scalars().all())

    assert initial_count == final_count


@pytest.mark.asyncio
async def test_ingest_invalid_confidence(base_valid_data, temp_json_file, async_db_session):
    base_valid_data["observations"][0]["confidence"] = "super-high"
    with open(temp_json_file, "w") as f:
        json.dump(base_valid_data, f)

    result = await async_db_session.execute(select(LocalityRentObservation))
    initial_count = len(result.scalars().all())
    await run_ingestion(
        temp_json_file, dry_run=False, session_factory=DummyFactory(async_db_session)
    )
    result = await async_db_session.execute(select(LocalityRentObservation))
    final_count = len(result.scalars().all())

    assert initial_count == final_count
