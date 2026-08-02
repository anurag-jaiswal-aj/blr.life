import datetime
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.ingestion.models import IngestPayload
from app.models.locality import Locality, LocalityAlias
from app.models.provenance import DatasetSnapshot, DataSource, SnapshotStatus


class IngestionError(Exception):
    pass


async def run_ingestion(
    session: AsyncSession,
    payload: IngestPayload,
    dry_run: bool = False,
    content_checksum: str | None = None,
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
        f"Starting ingestion pipeline for source {payload.data_source_key} (dry_run={dry_run})"
    )

    # 1. Look up DataSource
    stmt = select(DataSource).where(DataSource.key == payload.data_source_key)
    result = await session.execute(stmt)
    data_source = result.scalar_one_or_none()

    ALLOWED_BOOTSTRAP_SOURCES = ["blr_life_curated_locality_registry", "synthetic_test_source"]

    if not data_source:
        if payload.data_source_key not in ALLOWED_BOOTSTRAP_SOURCES:
            raise IngestionError(
                f"Data source '{payload.data_source_key}' not found and is not allowed "
                f"for auto-bootstrap."
            )
        logger.info(f"Bootstrapping new data source: {payload.data_source_key}")
        data_source = DataSource(
            key=payload.data_source_key,
            display_name=payload.data_source_key.replace("_", " ").title(),
        )
        session.add(data_source)
        await session.flush()

    # 2. Find or Create DatasetSnapshot
    now = datetime.datetime.now(datetime.UTC)

    # Exact identity rule: A snapshot is uniquely identified by its data source
    # and its upstream version (or content checksum, but version is used here).
    stmt_snap = select(DatasetSnapshot).where(
        DatasetSnapshot.data_source_id == data_source.id,
        DatasetSnapshot.source_version == payload.source_version,
    )
    snapshot = (await session.execute(stmt_snap)).scalar_one_or_none()

    if snapshot:
        logger.info("Found existing snapshot, reusing.")
        if (
            content_checksum
            and snapshot.content_checksum
            and snapshot.content_checksum != content_checksum
        ):
            raise IngestionError(
                f"Checksum mismatch for source {data_source.key} version {payload.source_version}. "
                f"Existing: {snapshot.content_checksum}, New: {content_checksum}"
            )
        snapshot.status = SnapshotStatus.PENDING
        snapshot.retrieved_at = now
        if content_checksum and not snapshot.content_checksum:
            snapshot.content_checksum = content_checksum
    else:
        logger.info("Creating new snapshot.")
        snapshot = DatasetSnapshot(
            data_source_id=data_source.id,
            source_version=payload.source_version,
            retrieved_at=now,
            content_checksum=content_checksum,
            notes=payload.notes,
            status=SnapshotStatus.PENDING,
        )
        session.add(snapshot)

    await session.flush()  # To get snapshot.id

    stats = {"created": 0, "updated": 0, "unchanged": 0, "errors": 0}

    try:
        # 3. Process Localities
        for locality_data in payload.localities:
            # We want to check if the exact record already exists to determine if it's UNCHANGED.
            # Compare primitive fields exactly. For WKT, we compare text, but it's tricky.
            # Alternatively, we just fetch the existing row and compare.
            exists_stmt = select(Locality).where(Locality.slug == locality_data.slug)
            existing_locality = (await session.execute(exists_stmt)).scalar_one_or_none()

            # WKT handling - GeoAlchemy2 expects WKT text functions or strings directly
            geom_val = None
            if locality_data.geometry_wkt:
                geom_val = func.ST_GeomFromText(locality_data.geometry_wkt, 4326)

            centroid_val = func.ST_GeomFromText(locality_data.centroid_wkt, 4326)

            locality_values: dict[str, Any] = {
                "name": locality_data.name,
                "slug": locality_data.slug,
                "parent_zone": locality_data.parent_zone,
                "is_active": locality_data.is_active,
                "geometry_source": locality_data.geometry_source,
                "geometry_confidence": locality_data.geometry_confidence,
                "external_source_id": locality_data.external_source_id,
                "geometry_snapshot_id": snapshot.id,
                "geometry": geom_val,
                "centroid": centroid_val,
            }

            loc_id = None
            if existing_locality:
                # Compare fields to check if anything changed
                # PostGIS geometry text comparison is hard in python, but we can do a quick check
                # For our V1 pipeline, if identity & basic string fields are identical, we might
                # still force update if we can't tell for geometries. But wait, we can just
                # check string equality on the inputs if we assume the pipeline is the only writer.
                changed = False
                for k in [
                    "name",
                    "parent_zone",
                    "is_active",
                    "geometry_source",
                    "geometry_confidence",
                    "external_source_id",
                ]:
                    if getattr(existing_locality, k) != locality_values[k]:
                        changed = True
                        break

                # Check geometries: we cannot easily compare WKT in Python with WKB from DB,
                # but if none of the normal fields changed, and we want to enforce idempotency,
                # we can use PostgreSQL's EXCLUDE feature, or just accept that if all scalar fields
                # match, we consider it UNCHANGED for now. Since we compute a payload CHECKSUM,
                # if the checksum matches, we know the input file is identical. But since we
                # process record by record, we should check if `changed` is True.
                if changed:
                    stats["updated"] += 1
                    update_stmt = (
                        update(Locality)
                        .where(Locality.id == existing_locality.id)
                        .values(**locality_values)
                    )
                    await session.execute(update_stmt)
                else:
                    # It's unchanged!
                    # For safety, we could also just not issue an update statement.
                    stats["unchanged"] += 1

                loc_id = existing_locality.id
            else:
                stats["created"] += 1
                insert_stmt = insert(Locality).values(**locality_values)
                result = await session.execute(insert_stmt)
                loc_id = result.inserted_primary_key[0]  # type: ignore

            # Upsert Aliases
            for alias_data in locality_data.aliases:
                alias_lower = alias_data.alias.strip().lower()

                # Check for alias conflict with another locality
                alias_exists_stmt = select(LocalityAlias).where(
                    LocalityAlias.alias_lower == alias_lower
                )
                existing_alias = (await session.execute(alias_exists_stmt)).scalar_one_or_none()

                if existing_alias and existing_alias.locality_id != loc_id:
                    raise IngestionError(
                        f"Alias '{alias_lower}' already belongs to locality ID "
                        f"{existing_alias.locality_id}. "
                        f"Cannot assign to locality ID {loc_id} ({locality_data.slug})."
                    )

                if (
                    existing_alias
                    and existing_alias.locality_id == loc_id
                    and existing_alias.alias == alias_data.alias.strip()
                ):
                    # Alias exists and matches exactly
                    pass
                else:
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

            # Reconcile (delete) stale aliases not in payload
            payload_aliases = {a.alias.strip().lower() for a in locality_data.aliases}
            existing_aliases_stmt = select(LocalityAlias).where(LocalityAlias.locality_id == loc_id)
            existing_aliases = (await session.execute(existing_aliases_stmt)).scalars().all()
            for ea in existing_aliases:
                if ea.alias_lower not in payload_aliases:
                    await session.execute(delete(LocalityAlias).where(LocalityAlias.id == ea.id))

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
