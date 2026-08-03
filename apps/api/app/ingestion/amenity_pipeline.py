import json
from pathlib import Path
from typing import Any

from geoalchemy2 import Geography
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.amenity import AmenityCategory, AmenityPOI
from app.models.locality import Locality
from app.models.observations import LocalityMetric, MetricConfidence, MetricType
from app.models.provenance import DatasetSnapshot, DataSource, SnapshotStatus


class IngestionError(Exception):
    pass


async def run_amenity_ingestion(
    session: AsyncSession,
    file_path: str,
    dry_run: bool = False,
    content_checksum: str | None = None,
) -> dict[str, Any]:
    stats = {"created": 0, "updated": 0, "unchanged": 0, "deactivated": 0}

    path = Path(file_path)
    if not path.is_file():
        raise IngestionError(f"File not found: {file_path}")

    with path.open() as f:
        data = json.load(f)

    pois = data.get("pois", [])
    if not pois:
        return stats

    # 1. Resolve Data Source
    source_key = "osm_amenity_poi_extract"
    ds_stmt = select(DataSource).where(DataSource.key == source_key)
    data_source = (await session.execute(ds_stmt)).scalar_one_or_none()
    if not data_source:
        data_source = DataSource(
            key=source_key,
            display_name="OSM Amenity POI Extract",
            license_identifier="ODbL-1.0",
            attribution_text="OpenStreetMap contributors (ODbL).",
        )
        session.add(data_source)
        await session.flush()
    assert data_source is not None

    # 2. Resolve Snapshot
    snap_stmt = select(DatasetSnapshot).where(
        DatasetSnapshot.data_source_id == data_source.id,
        DatasetSnapshot.source_version == "v1",
    )
    if content_checksum:
        snap_stmt = snap_stmt.where(DatasetSnapshot.content_checksum == content_checksum)

    snapshot = (await session.execute(snap_stmt)).scalar_one_or_none()
    if not snapshot:
        snapshot = DatasetSnapshot(
            data_source_id=data_source.id,
            source_version="v1",
            retrieved_at=func.now(),
            content_checksum=content_checksum,
            status=SnapshotStatus.PENDING,
        )
        session.add(snapshot)
        await session.flush()
    assert snapshot is not None

    # 3. Fetch existing POIs to identify stale records
    existing_stmt = (
        select(AmenityPOI)
        .join(DatasetSnapshot, AmenityPOI.snapshot_id == DatasetSnapshot.id)
        .where(
            DatasetSnapshot.data_source_id == data_source.id,
        )
    )
    existing_pois_result = (await session.execute(existing_stmt)).scalars().all()
    existing_poi_map = {p.osm_id: p for p in existing_pois_result}

    seen_osm_ids = set()

    # 4. Upsert POIs
    for poi in pois:
        osm_id = poi["osm_id"]
        seen_osm_ids.add(osm_id)

        point_wkt = f"POINT({poi['lon']} {poi['lat']})"
        geom = func.ST_GeomFromEWKT(f"SRID=4326;{point_wkt}")
        category = AmenityCategory(poi["category"])
        name = poi.get("name")

        existing_poi = existing_poi_map.get(osm_id)

        if existing_poi:
            changed = False
            if existing_poi.name != name:
                existing_poi.name = name
                changed = True
            if existing_poi.category != category:
                existing_poi.category = category
                changed = True
            if existing_poi.snapshot_id != snapshot.id:
                existing_poi.snapshot_id = snapshot.id
                changed = True
            if not existing_poi.is_active:
                existing_poi.is_active = True
                changed = True

            # Since assigning to geometry dirties the session unconditionally,
            # we consider it an 'update' if any scalar field was changed.
            existing_poi.geometry = geom

            if changed:
                stats["updated"] += 1
            else:
                stats["unchanged"] += 1

        else:
            new_poi = AmenityPOI(
                name=name,
                category=category,
                osm_id=osm_id,
                geometry=geom,
                snapshot_id=snapshot.id,
                is_active=True,
            )
            session.add(new_poi)
            stats["created"] += 1

    # 5. Stale POI Reconciliation
    for osm_id, poi_record in existing_poi_map.items():
        if osm_id not in seen_osm_ids and poi_record.is_active:
            poi_record.is_active = False
            stats["deactivated"] += 1

    snapshot.status = SnapshotStatus.COMPLETED
    snapshot.is_current = True
    await session.flush()

    if dry_run:
        await session.rollback()
    else:
        await session.commit()

    return stats


async def calculate_amenity_metrics(
    session: AsyncSession, dry_run: bool = False, calc_version: str = "amenity-accessibility-v1"
) -> dict[str, Any]:
    stats = {"created": 0, "updated": 0, "unchanged": 0}

    categories = [
        ("cafe", MetricType.CAFE_ACCESSIBILITY),
        ("restaurant", MetricType.RESTAURANT_ACCESSIBILITY),
        ("park", MetricType.PARK_ACCESSIBILITY),
        ("healthcare", MetricType.HEALTHCARE_ACCESSIBILITY),
        ("nightlife", MetricType.NIGHTLIFE_ACCESSIBILITY),
    ]

    localities = (
        (await session.execute(select(Locality).where(Locality.is_active.is_(True))))
        .scalars()
        .all()
    )

    existing_metrics_stmt = select(LocalityMetric).where(
        LocalityMetric.calc_version == calc_version
    )
    existing_metrics_list = (await session.execute(existing_metrics_stmt)).scalars().all()
    existing_metrics = {(m.locality_id, m.metric_type): m for m in existing_metrics_list}

    for loc in localities:
        for cat_str, metric_type in categories:
            query = (
                select(func.count(AmenityPOI.id))
                .where(AmenityPOI.category == cat_str)
                .where(AmenityPOI.is_active.is_(True))
                .where(
                    func.ST_DWithin(
                        func.ST_Transform(loc.centroid, 4326).cast(Geography()),
                        func.ST_Transform(AmenityPOI.geometry, 4326).cast(Geography()),
                        1500,  # meters
                    )
                )
            )
            count_val = (await session.execute(query)).scalar() or 0

            existing = existing_metrics.get((loc.id, metric_type))

            if existing:
                if existing.value != count_val or existing.confidence != MetricConfidence.MEDIUM:
                    existing.value = count_val
                    existing.confidence = MetricConfidence.MEDIUM
                    existing.calculated_at = func.now()
                    stats["updated"] += 1
                else:
                    stats["unchanged"] += 1
            else:
                new_metric = LocalityMetric(
                    locality_id=loc.id,
                    metric_type=metric_type,
                    value=count_val,
                    unit="count/1.5km",
                    calc_version=calc_version,
                    calculated_at=func.now(),
                    confidence=MetricConfidence.MEDIUM,
                    is_current=True,
                    extra_data={"radius_m": 1500},
                )
                session.add(new_metric)
                stats["created"] += 1

    if dry_run:
        await session.rollback()
    else:
        await session.commit()

    return stats
