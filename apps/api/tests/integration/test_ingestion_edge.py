
import pytest
import pytest_asyncio
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ingestion.models import IngestLocality, IngestLocalityAlias, IngestPayload
from app.ingestion.pipeline import IngestionError, run_ingestion
from app.models.locality import Locality
from tests.integration.test_domain_integration import TEST_ASYNC_URL


@pytest_asyncio.fixture
async def async_db_session():
    engine = create_async_engine(TEST_ASYNC_URL, echo=False)
    async_session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with engine.connect() as conn:
        await conn.begin_nested()
        async with async_session_factory(bind=conn) as session:
            yield session
        await conn.rollback()
    
    await engine.dispose()


@pytest.mark.asyncio
async def test_invalid_geometry():
    # Should reject POINT for geometry
    with pytest.raises(ValidationError) as exc:
        IngestLocality(
            name="Test",
            slug="test",
            centroid_wkt="POINT(77.6 12.9)",
            geometry_wkt="POINT(77.6 12.9)"
        )
    assert "geometry_wkt must be a POLYGON or MULTIPOLYGON" in str(exc.value)

    # Should reject POLYGON for centroid
    with pytest.raises(ValidationError) as exc:
        IngestLocality(
            name="Test",
            slug="test",
            centroid_wkt="POLYGON((77.6 12.9, ...))",
            geometry_wkt="POLYGON((77.6 12.9, ...))"
        )
    assert "centroid_wkt must be a POINT" in str(exc.value)


@pytest.mark.asyncio
async def test_alias_conflict(async_db_session):
    await async_db_session.execute(
        text(
            "INSERT INTO data_source (key, display_name, status) "
            "VALUES ('test_source', 'Test Source', 'active')"
        )
    )

    # Locality 1 takes alias 'btm'
    payload1 = IngestPayload(
        data_source_key="test_source",
        localities=[
            IngestLocality(
                name="BTM Layout", slug="btm-layout", centroid_wkt="POINT(77.6 12.9)",
                aliases=[IngestLocalityAlias(alias="BTM")]
            )
        ]
    )
    await run_ingestion(async_db_session, payload1)

    # Locality 2 tries to take 'BTM'
    payload2 = IngestPayload(
        data_source_key="test_source",
        localities=[
            IngestLocality(
                name="Another Layout", slug="another-layout", centroid_wkt="POINT(77.6 12.9)",
                aliases=[IngestLocalityAlias(alias="btm ")]
            )
        ]
    )
    
    with pytest.raises(IngestionError):
        await run_ingestion(async_db_session, payload2)


@pytest.mark.asyncio
async def test_transaction_rollback_on_partial_failure(async_db_session):
    await async_db_session.execute(
        text(
            "INSERT INTO data_source (key, display_name, status) "
            "VALUES ('test_source', 'Test Source', 'active')"
        )
    )

    payload = IngestPayload(
        data_source_key="test_source",
        localities=[
            IngestLocality(
                name="Good Locality", slug="good-locality", centroid_wkt="POINT(77.6 12.9)",
            ),
            IngestLocality(
                # Empty canonical name is invalid at DB layer (constraint)
                name="  ", slug="bad-locality", centroid_wkt="POINT(77.6 12.9)",
            )
        ]
    )
    
    with pytest.raises(IngestionError):
        await run_ingestion(async_db_session, payload)

    # Verify that Good Locality was NOT inserted (rolled back)
    result = await async_db_session.execute(
        select(Locality).where(Locality.slug == "good-locality")
    )
    assert result.scalar_one_or_none() is None

