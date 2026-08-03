import json
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.locality import Locality
from app.models.observations import HousingConfiguration, LocalityRentObservation, MetricConfidence
from app.models.provenance import DatasetSnapshot, DataSource, SnapshotStatus


class IngestionError(Exception):
    pass


async def run_rent_ingestion(
    session: AsyncSession,
    file_path: str,
    dry_run: bool = False,
    content_checksum: str | None = None,
) -> dict[str, Any]:
    stats = {"created": 0, "deactivated": 0, "unchanged": 0}

    path = Path(file_path)
    if not path.is_file():
        raise IngestionError(f"File not found: {file_path}")

    with path.open() as f:
        data = json.load(f)

    observations = data.get("observations", [])
    if not observations:
        return stats

    # 1. Resolve Data Source
    source_key = "blr_life_curated_rent"
    ds_stmt = select(DataSource).where(DataSource.key == source_key)
    data_source = (await session.execute(ds_stmt)).scalar_one_or_none()
    if not data_source:
        data_source = DataSource(
            key=source_key,
            display_name="Curated Rent Affordability Bands",
            license_identifier="Proprietary / CC-BY",
            attribution_text="Manually curated from public market reports.",
        )
        session.add(data_source)
        await session.flush()
    assert data_source is not None

    # 2. Resolve Snapshot
    version = data.get("dataset_version", "v1")
    snap_stmt = select(DatasetSnapshot).where(
        DatasetSnapshot.data_source_id == data_source.id,
        DatasetSnapshot.source_version == version,
    )
    if content_checksum:
        snap_stmt = snap_stmt.where(DatasetSnapshot.content_checksum == content_checksum)

    snapshot = (await session.execute(snap_stmt)).scalar_one_or_none()
    if not snapshot:
        snapshot = DatasetSnapshot(
            data_source_id=data_source.id,
            source_version=version,
            retrieved_at=func.now(),
            content_checksum=content_checksum,
            status=SnapshotStatus.PENDING,
            notes=data.get("methodology"),
        )
        session.add(snapshot)
        await session.flush()
    assert snapshot is not None

    # 3. Load active localities
    loc_stmt = select(Locality).where(Locality.is_active.is_(True))
    localities = (await session.execute(loc_stmt)).scalars().all()
    locality_map = {loc.slug: loc.id for loc in localities}

    # 4. Process Observations
    # To maintain idempotency, we track which (locality_id, bhk) we processed.
    processed_combos = set()

    for obs in observations:
        slug = obs["locality_slug"]
        bhk_str = obs["bhk"]
        rent_min = obs.get("rent_min_inr")
        rent_max = obs.get("rent_max_inr")
        confidence_str = obs.get("confidence", "low")
        provenance = obs.get("provenance")
        notes = json.dumps(provenance) if provenance else None

        locality_id = locality_map.get(slug)
        if not locality_id:
            continue

        try:
            bhk = HousingConfiguration(bhk_str)
            confidence = MetricConfidence(confidence_str)
        except ValueError as e:
            raise IngestionError(f"Invalid enum value in rent data: {e}") from e

        combo_key = (locality_id, bhk)
        if combo_key in processed_combos:
            # Skip duplicates in the same file
            continue
        processed_combos.add(combo_key)

        # Check if identical current observation exists
        existing_stmt = select(LocalityRentObservation).where(
            LocalityRentObservation.locality_id == locality_id,
            LocalityRentObservation.housing_config == bhk,
            LocalityRentObservation.is_current.is_(True),
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()

        if existing:
            if (
                existing.rent_min_inr == rent_min
                and existing.rent_max_inr == rent_max
                and existing.confidence == confidence
                and existing.snapshot_id == snapshot.id
            ):
                stats["unchanged"] += 1
                continue

            # If changed, deactivate the old one
            if not dry_run:
                existing.is_current = False
            stats["deactivated"] += 1

        if not dry_run:
            new_obs = LocalityRentObservation(
                locality_id=locality_id,
                housing_config=bhk,
                rent_min_inr=rent_min,
                rent_max_inr=rent_max,
                snapshot_id=snapshot.id,
                confidence=confidence,
                notes=notes,
                is_current=True,
            )
            session.add(new_obs)
        stats["created"] += 1

    # 5. Deactivate stale observations belonging to the SAME data source
    stale_stmt = (
        select(LocalityRentObservation)
        .join(DatasetSnapshot, LocalityRentObservation.snapshot_id == DatasetSnapshot.id)
        .where(
            LocalityRentObservation.is_current.is_(True),
            DatasetSnapshot.data_source_id == data_source.id,
        )
    )
    stale_obs = (await session.execute(stale_stmt)).scalars().all()
    for s in stale_obs:
        if (s.locality_id, s.housing_config) not in processed_combos:
            if not dry_run:
                s.is_current = False
            stats["deactivated"] += 1

    if not dry_run:
        snapshot.status = SnapshotStatus.COMPLETED
        await session.commit()
    else:
        await session.rollback()

    return stats
