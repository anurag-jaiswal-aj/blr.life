import json
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ingestion.models import IngestPayload
from app.ingestion.pipeline import run_ingestion
from app.models.locality import Locality, LocalityAlias
from app.models.provenance import DatasetSnapshot
from tests.integration.test_domain_integration import TEST_ASYNC_URL


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
def synthetic_payload():
    fixture_path = Path(__file__).parent.parent / "fixtures" / "synthetic_ingestion.json"
    with open(fixture_path, encoding="utf-8") as f:
        data = json.load(f)
    return IngestPayload.model_validate(data)


@pytest.mark.asyncio
async def test_dry_run_ingestion(async_db_session, synthetic_payload):
    # Setup Data Source required by the payload
    await async_db_session.execute(
        text(
            "INSERT INTO data_source (key, display_name, status) "
            "VALUES ('synthetic_test_source', 'Test Source', 'active') "
            "ON CONFLICT DO NOTHING"
        )
    )

    stats = await run_ingestion(async_db_session, synthetic_payload, dry_run=True)

    assert stats["created"] == 2
    assert stats["updated"] == 0

    # Verify no localities were committed
    count = await async_db_session.execute(select(Locality))
    assert len(count.scalars().all()) == 0


@pytest.mark.asyncio
async def test_actual_ingestion(async_db_session, synthetic_payload):
    # Setup Data Source
    await async_db_session.execute(
        text(
            "INSERT INTO data_source (key, display_name, status) "
            "VALUES ('synthetic_test_source', 'Test Source', 'active') "
            "ON CONFLICT DO NOTHING"
        )
    )

    stats = await run_ingestion(async_db_session, synthetic_payload, dry_run=False)

    assert stats["created"] == 2

    # Verify localities
    result = await async_db_session.execute(
        select(Locality).where(Locality.slug == "fiction-nagar")
    )
    locality = result.scalar_one()
    assert locality.name == "Fiction Nagar"

    # Verify aliases
    result = await async_db_session.execute(
        select(LocalityAlias).where(LocalityAlias.locality_id == locality.id)
    )
    aliases = result.scalars().all()
    assert len(aliases) == 2

    # Verify snapshot
    result = await async_db_session.execute(select(DatasetSnapshot))
    snapshot = result.scalars().first()
    assert snapshot is not None
    assert snapshot.status == "completed"


@pytest.mark.asyncio
async def test_idempotent_ingestion(async_db_session, synthetic_payload):
    # Setup Data Source
    await async_db_session.execute(
        text(
            "INSERT INTO data_source (key, display_name, status) "
            "VALUES ('synthetic_test_source', 'Test Source', 'active') "
            "ON CONFLICT DO NOTHING"
        )
    )

    # First run
    stats1 = await run_ingestion(async_db_session, synthetic_payload, dry_run=False)
    assert stats1["created"] == 2
    assert stats1["updated"] == 0

    # Second run with same payload
    stats2 = await run_ingestion(async_db_session, synthetic_payload, dry_run=False)
    assert stats2["created"] == 0
    assert stats2["updated"] == 0
    assert stats2.get("unchanged", 0) == 2

    # Verify only 2 localities exist total
    result = await async_db_session.execute(select(Locality))
    localities = result.scalars().all()
    assert len(localities) == 2
