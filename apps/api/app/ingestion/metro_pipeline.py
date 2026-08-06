import datetime
from typing import Any, cast

from sqlalchemy import CursorResult, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion.metro_models import IngestMetroPayload
from app.models.locality import Locality
from app.models.metro import MetroStation
from app.models.observations import LocalityMetric, MetricConfidence, MetricType
from app.models.provenance import DatasetSnapshot, DataSource, SnapshotStatus


class IngestionError(Exception):
    pass


async def run_metro_ingestion(
    session: AsyncSession,
    payload: IngestMetroPayload,
    dry_run: bool = False,
    content_checksum: str | None = None,
) -> dict[str, Any]:
    stats = {"created": 0, "updated": 0, "unchanged": 0, "deactivated": 0}

    # 1. Resolve Data Source
    ds_stmt = select(DataSource).where(DataSource.key == payload.source_key)
    result = await session.execute(ds_stmt)
    data_source = result.scalar_one_or_none()
    if not data_source:
        if payload.source_key != "blr_life_curated_metro_stations":
            raise IngestionError(f"Unknown data source key: {payload.source_key}")
        data_source = DataSource(
            key=payload.source_key,
            display_name="blr.life Curated Metro Stations (V1)",
            license_identifier="ODbL-1.0",
            attribution_text="OpenStreetMap contributors (ODbL). Curated by blr.life.",
        )
        session.add(data_source)
        await session.flush()
    assert data_source is not None

    # 2. Resolve Snapshot
    snap_stmt = select(DatasetSnapshot).where(
        DatasetSnapshot.data_source_id == data_source.id,
        DatasetSnapshot.source_version == payload.source_version,
    )
    if content_checksum:
        snap_stmt = snap_stmt.where(DatasetSnapshot.content_checksum == content_checksum)

    snap_result = await session.execute(snap_stmt)
    snapshot = snap_result.scalar_one_or_none()

    if not snapshot:
        dt_str = payload.data_retrieved_at.replace("Z", "+00:00")
        snapshot = DatasetSnapshot(
            data_source_id=data_source.id,
            source_version=payload.source_version,
            retrieved_at=datetime.datetime.fromisoformat(dt_str),
            content_checksum=content_checksum,
            status=SnapshotStatus.PENDING,
        )
        session.add(snapshot)
        await session.flush()
    assert snapshot is not None

    # 3. Upsert stations
    payload_slugs = []
    for station in payload.stations:
        payload_slugs.append(station.slug)
        point_wkt = f"POINT({station.longitude} {station.latitude})"

        existing = (
            await session.execute(select(MetroStation).where(MetroStation.slug == station.slug))
        ).scalar_one_or_none()

        if existing:
            stmt = (
                update(MetroStation)
                .where(MetroStation.id == existing.id)
                .where(
                    (MetroStation.name != station.name)
                    | (MetroStation.osm_id != station.osm_id)
                    | (MetroStation.is_operational != station.is_operational)
                    | (MetroStation.line != station.line)
                    | (
                        func.ST_Equals(
                            MetroStation.geometry, func.ST_GeomFromEWKT(f"SRID=4326;{point_wkt}")
                        ).is_not(True)
                    )
                    | (MetroStation.is_active.is_not(True))
                )
                .values(
                    name=station.name,
                    osm_id=station.osm_id,
                    is_operational=station.is_operational,
                    line=station.line,
                    geometry=func.ST_GeomFromEWKT(f"SRID=4326;{point_wkt}"),
                    snapshot_id=snapshot.id,
                    is_active=True,
                    updated_at=func.now(),
                )
            )
            update_result = cast(CursorResult[Any], await session.execute(stmt))
            if update_result.rowcount > 0:
                stats["updated"] += 1
            else:
                stats["unchanged"] += 1
        else:
            new_station = MetroStation(
                name=station.name,
                slug=station.slug,
                osm_id=station.osm_id,
                is_operational=station.is_operational,
                line=station.line,
                geometry=func.ST_GeomFromEWKT(f"SRID=4326;{point_wkt}"),
                snapshot_id=snapshot.id,
                is_active=True,
            )
            session.add(new_station)
            stats["created"] += 1

    # 4. Stale Station Reconciliation
    if payload_slugs:
        # Find all stations that are active but not in the payload
        # Ensure we only deactivate stations that belong to this data source
        stale_stmt = (
            update(MetroStation)
            .where(MetroStation.is_active.is_(True))
            .where(MetroStation.slug.notin_(payload_slugs))
            .where(
                MetroStation.snapshot_id.in_(
                    select(DatasetSnapshot.id).where(
                        DatasetSnapshot.data_source_id == data_source.id
                    )
                )
            )
            .values(is_active=False, updated_at=func.now())
        )
        stale_result = cast(CursorResult[Any], await session.execute(stale_stmt))
        if stale_result.rowcount > 0:
            stats["deactivated"] = stale_result.rowcount

    snapshot.status = SnapshotStatus.COMPLETED
    snapshot.is_current = True
    await session.flush()

    if dry_run:
        await session.rollback()
    else:
        await session.commit()

    return stats


async def calculate_metro_metrics(
    session: AsyncSession, dry_run: bool = False, calc_version: str = "metro-distance-v1"
) -> dict[str, Any]:
    stats = {"created": 0, "updated": 0, "unchanged": 0}

    calc_snap_stmt = (
        select(DatasetSnapshot)
        .join(DataSource)
        .where(
            DataSource.key == "blr_life_curated_metro_stations",
            DatasetSnapshot.status == SnapshotStatus.COMPLETED,
        )
        .order_by(DatasetSnapshot.created_at.desc())
        .limit(1)
    )

    latest_snapshot = (await session.execute(calc_snap_stmt)).scalar_one_or_none()
    snapshot_id = latest_snapshot.id if latest_snapshot else None

    # Get all active localities
    localities = (
        (await session.execute(select(Locality).where(Locality.is_active.is_(True))))
        .scalars()
        .all()
    )

    from geoalchemy2 import Geography

    for loc in localities:
        # PostGIS query to find nearest active Metro station
        query = (
            select(
                MetroStation.slug,
                MetroStation.name,
                MetroStation.line,
                func.ST_Distance(
                    func.ST_Transform(loc.centroid, 4326).cast(Geography()),
                    func.ST_Transform(MetroStation.geometry, 4326).cast(Geography()),
                ).label("distance"),
            )
            .where(MetroStation.is_active.is_(True))
            .where(MetroStation.is_operational.is_(True))
            .order_by("distance")
            .limit(1)
        )

        result = (await session.execute(query)).first()
        if not result:
            continue

        nearest_slug, nearest_name, nearest_line, distance_m = result
        extra_data = {
            "nearest_station_slug": nearest_slug,
            "nearest_station_name": nearest_name,
            "nearest_station_line": nearest_line,
        }

        # Check existing metric
        existing_stmt = select(LocalityMetric).where(
            LocalityMetric.locality_id == loc.id,
            LocalityMetric.metric_type == MetricType.METRO_DISTANCE_M,
            LocalityMetric.calc_version == calc_version,
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()

        if existing:
            # Semantic comparison (allow 0.001m float difference)
            if (
                abs(float(existing.value) - distance_m) > 0.001
                or existing.confidence != MetricConfidence.HIGH
                or existing.is_current is not True
                or existing.extra_data != extra_data
            ):
                stmt = (
                    update(LocalityMetric)
                    .where(LocalityMetric.id == existing.id)
                    .values(
                        value=distance_m,
                        confidence=MetricConfidence.HIGH,
                        is_current=True,
                        extra_data=extra_data,
                        calculated_at=func.now(),
                        snapshot_id=snapshot_id,
                    )
                )
                await session.execute(stmt)
                stats["updated"] += 1
            else:
                stats["unchanged"] += 1
        else:
            new_metric = LocalityMetric(
                locality_id=loc.id,
                metric_type=MetricType.METRO_DISTANCE_M,
                value=distance_m,
                unit="metres",
                calc_version=calc_version,
                calculated_at=func.now(),
                snapshot_id=snapshot_id,
                confidence=MetricConfidence.HIGH,
                is_current=True,
                extra_data=extra_data,
            )
            session.add(new_metric)
            stats["created"] += 1

    if dry_run:
        await session.rollback()
    else:
        await session.commit()

    return stats
