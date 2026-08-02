import datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.ingestion.models import IngestPayload
from app.models.locality import Locality, LocalityAlias
from app.models.provenance import DatasetSnapshot, DataSource, SnapshotStatus


class IngestionError(Exception):
    pass


async def run_ingestion(
    session: AsyncSession, payload: IngestPayload, dry_run: bool = False
) -> dict[str, Any]:
    """Execute the data ingestion pipeline within a single transaction.

    Args:
        session: Active SQLAlchemy async session.
        payload: Validated payload containing localities.
        dry_run: If True, the transaction will be rolled back at the end.

    Returns:
        A dictionary with summary statistics of the import.
    """
    logger.info(
        f"Starting ingestion pipeline for source {payload.data_source_key} "
        f"(dry_run={dry_run})"
    )
    
    # 1. Look up DataSource
    stmt = select(DataSource).where(DataSource.key == payload.data_source_key)
    result = await session.execute(stmt)
    data_source = result.scalar_one_or_none()

    if not data_source:
        raise IngestionError(f"Data source with key '{payload.data_source_key}' not found.")

    # 2. Find or Create DatasetSnapshot
    now = datetime.datetime.now(datetime.UTC)
    
    # Exact identity rule: A snapshot is uniquely identified by its data source
    # and its upstream version (or content checksum, but version is used here).
    stmt_snap = select(DatasetSnapshot).where(
        DatasetSnapshot.data_source_id == data_source.id,
        DatasetSnapshot.source_version == payload.source_version
    )
    snapshot = (await session.execute(stmt_snap)).scalar_one_or_none()
    
    if snapshot:
        logger.info("Found existing snapshot, reusing.")
        snapshot.status = SnapshotStatus.PENDING
        snapshot.retrieved_at = now
    else:
        logger.info("Creating new snapshot.")
        snapshot = DatasetSnapshot(
            data_source_id=data_source.id,
            source_version=payload.source_version,
            retrieved_at=now,
            notes=payload.notes,
            status=SnapshotStatus.PENDING,
        )
        session.add(snapshot)
    
    await session.flush()  # To get snapshot.id

    stats = {"created": 0, "updated": 0, "errors": 0}

    try:
        # 3. Process Localities
        for locality_data in payload.localities:
            # Upsert Locality
            locality_values: dict[str, Any] = {
                "name": locality_data.name,
                "slug": locality_data.slug,
                "parent_zone": locality_data.parent_zone,
                "is_active": locality_data.is_active,
                "geometry_source": locality_data.geometry_source,
                "geometry_confidence": locality_data.geometry_confidence,
                "external_source_id": locality_data.external_source_id,
                "geometry_snapshot_id": snapshot.id,
            }

            # WKT handling - GeoAlchemy2 expects WKT text functions or strings directly
            if locality_data.geometry_wkt:
                locality_values["geometry"] = func.ST_GeomFromText(locality_data.geometry_wkt, 4326)
            else:
                locality_values["geometry"] = None

            locality_values["centroid"] = func.ST_GeomFromText(locality_data.centroid_wkt, 4326)

            insert_stmt = insert(Locality).values(**locality_values)
            
            # On conflict with slug, update the values
            update_dict = {
                c.name: c
                for c in insert_stmt.excluded
                if c.name not in ["id", "created_at"]
            }
            _upsert_stmt = insert_stmt.on_conflict_do_update(
                index_elements=["slug"],
                set_=update_dict,
            ).returning(
                Locality.id,
                (insert_stmt.excluded.slug == Locality.slug).label("was_updated"),
            )
            
            # Note: We need a reliable way to distinguish insert vs update.
            # `(insert_stmt.excluded.slug == Locality.slug)` doesn't actually tell us 
            # if it existed before. PostgreSQL doesn't return `xmax` reliably via 
            # SQLAlchemy ORM without raw SQL easily. So we will do a select first, or just 
            # accept that the UPSERT is atomic and we count them all as 'processed'.
            # Let's count them by querying if it exists first to get accurate stats.
            
            exists_stmt = select(Locality.id).where(Locality.slug == locality_data.slug)
            existing_id = (await session.execute(exists_stmt)).scalar_one_or_none()
            
            if existing_id:
                stats["updated"] += 1
                # Execute normal update instead of raw upsert since we already have the ID
                update_stmt = (
                    update(Locality)
                    .where(Locality.id == existing_id)
                    .values(**locality_values)
                )
                await session.execute(update_stmt)
                loc_id = existing_id
            else:
                stats["created"] += 1
                result = await session.execute(insert_stmt)
                loc_id = result.inserted_primary_key[0] # type: ignore

            # Upsert Aliases
            for alias_data in locality_data.aliases:
                alias_lower = alias_data.alias.strip().lower()
                alias_values = {
                    "locality_id": loc_id,
                    "alias": alias_data.alias.strip(),
                    "alias_lower": alias_lower,
                }
                alias_insert = insert(LocalityAlias).values(**alias_values)
                alias_upsert = alias_insert.on_conflict_do_update(
                    index_elements=["alias_lower"],
                    set_={
                        "alias": alias_insert.excluded.alias,
                        "locality_id": alias_insert.excluded.locality_id,
                    },
                )
                await session.execute(alias_upsert)

        # 4. Mark snapshot completed
        snapshot.status = SnapshotStatus.COMPLETED

        if dry_run:
            logger.info("Dry run requested. Rolling back transaction.")
            await session.rollback()
        else:
            logger.info("Committing ingestion transaction.")
            await session.commit()

        return stats
    
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        snapshot.status = SnapshotStatus.FAILED
        await session.rollback()
        # To persist the failed status, we must open a new transaction and update the snapshot.
        # But since the snapshot was not committed, it doesn't exist in DB to update. 
        # In a robust ETL, we'd commit the PENDING snapshot first, then in a new transaction
        # do the work. For V1, failing the transaction is sufficient.
        raise IngestionError(f"Pipeline failed: {e}") from e
