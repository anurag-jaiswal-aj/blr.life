import argparse
import asyncio
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.session import engine
from app.models.locality import Locality
from app.models.observations import HousingConfiguration, LocalityRentObservation, MetricConfidence
from app.models.provenance import DatasetSnapshot, DataSource, SnapshotStatus, SourceStatus


class Provenance(BaseModel):
    publisher: str
    source_title: str
    source_url: str | None
    published_at: str | None
    accessed_at: str
    source_type: str
    sample_count: int | None
    derivation: str


class Observation(BaseModel):
    locality_slug: str
    bhk: str
    rent_min_inr: int | None
    rent_max_inr: int | None
    confidence: str
    provenance: Provenance

    @field_validator("bhk")
    @classmethod
    def validate_bhk(cls, v):
        try:
            return HousingConfiguration(v).value
        except ValueError as err:
            raise ValueError(f"Invalid housing_config: {v}") from err

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        try:
            return MetricConfidence(v).value
        except ValueError as err:
            raise ValueError(f"Invalid confidence: {v}") from err

    @model_validator(mode="after")
    def validate_rent(self) -> "Observation":
        if self.rent_min_inr is None and self.rent_max_inr is None:
            raise ValueError("At least one rent boundary must be provided")
        if self.rent_min_inr is not None and self.rent_min_inr < 0:
            raise ValueError("rent_min_inr must be non-negative")
        if self.rent_max_inr is not None and self.rent_max_inr < 0:
            raise ValueError("rent_max_inr must be non-negative")
        if self.rent_min_inr is not None and self.rent_max_inr is not None:
            if self.rent_min_inr > self.rent_max_inr:
                raise ValueError("rent_min_inr must be <= rent_max_inr")
        return self


class RentDataset(BaseModel):
    dataset_version: str
    created_at: str
    methodology: str
    confidence_methodology: str
    observation_count: int
    observations: list[Observation]


def generate_source_key(publisher: str, title: str) -> str:
    key = f"rent_{publisher.lower()}_{title.lower()}"
    key = "".join(c if c.isalnum() else "_" for c in key)
    return key[:80]


CONFIDENCE_RANK = {
    MetricConfidence.HIGH: 4,
    MetricConfidence.MEDIUM: 3,
    MetricConfidence.LOW: 2,
    MetricConfidence.INSUFFICIENT: 1,
}


async def run_ingestion(input_path: str, dry_run: bool, session_factory=None):
    if session_factory is None:
        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        session_factory = async_session

    print(f"Reading {input_path}...")
    path = Path(input_path)
    if not path.exists():
        print(f"Error: {input_path} does not exist.")
        return

    content = path.read_text()
    checksum = hashlib.sha256(content.encode()).hexdigest()

    try:
        data = json.loads(content)
        dataset = RentDataset(**data)
    except Exception as e:
        print(f"Validation Error in JSON structure: {e}")
        return

    print(f"Parsed {len(dataset.observations)} observations.")

    async with session_factory() as session:
        # Resolve all localities
        slugs = [obs.locality_slug for obs in dataset.observations]
        res = await session.execute(select(Locality).where(Locality.slug.in_(slugs)))
        localities_by_slug = {loc.slug: loc for loc in res.scalars()}

        valid_obs = []
        invalid_count = 0

        for obs in dataset.observations:
            if obs.locality_slug not in localities_by_slug:
                print(f"Validation Error: Unknown locality slug '{obs.locality_slug}'")
                invalid_count += 1
                continue

            valid_obs.append(obs)

        if invalid_count > 0:
            print("Fatal: Validation failed. Cancelling ingestion to prevent partial DB mutation.")
            return

        print(f"All {len(valid_obs)} observations passed validation.")

        if dry_run:
            print("\n--- DRY RUN SUMMARY ---")
            print(f"Input count: {len(dataset.observations)}")
            print(f"Valid count: {len(valid_obs)}")
            print(f"Invalid count: {invalid_count}")
            print("Action: NO WRITES (Dry run mode)")
            return

        print("\n--- EXECUTING INGESTION ---")
        try:
            # Upsert DataSources and DatasetSnapshots
            # Since observations might have different provenances, we process them by provenance
            snapshot_map = {}  # key -> snapshot_id

            for obs in valid_obs:
                prov = obs.provenance
                key = generate_source_key(prov.publisher, prov.source_title)

                if key not in snapshot_map:
                    # Check if DataSource exists
                    ds = (
                        await session.execute(select(DataSource).where(DataSource.key == key))
                    ).scalar_one_or_none()
                    if not ds:
                        ds = DataSource(
                            key=key,
                            display_name=f"{prov.publisher} - {prov.source_title}",
                            source_url=prov.source_url,
                            status=SourceStatus.ACTIVE,
                        )
                        session.add(ds)
                        await session.flush()

                    # Check if Snapshot exists
                    snap = (
                        await session.execute(
                            select(DatasetSnapshot).where(
                                DatasetSnapshot.data_source_id == ds.id,
                                DatasetSnapshot.source_version == dataset.dataset_version,
                                DatasetSnapshot.content_checksum == checksum,
                            )
                        )
                    ).scalar_one_or_none()

                    if not snap:
                        try:
                            accessed_at = datetime.fromisoformat(prov.accessed_at)
                        except ValueError:
                            accessed_at = datetime.now(UTC)

                        snap = DatasetSnapshot(
                            data_source_id=ds.id,
                            source_version=dataset.dataset_version,
                            retrieved_at=accessed_at,
                            content_checksum=checksum,
                            status=SnapshotStatus.COMPLETED,
                            notes=prov.derivation,
                        )
                        session.add(snap)
                        await session.flush()

                    snapshot_map[key] = snap.id

            # Upsert Observations
            new_count = 0
            deprecated_count = 0
            skipped_count = 0

            for obs in valid_obs:
                loc = localities_by_slug[obs.locality_slug]
                prov = obs.provenance
                key = generate_source_key(prov.publisher, prov.source_title)
                snap_id = snapshot_map[key]

                # Check for existing current observation
                existing_obs = (
                    await session.execute(
                        select(LocalityRentObservation).where(
                            LocalityRentObservation.locality_id == loc.id,
                            LocalityRentObservation.housing_config == obs.bhk,
                            LocalityRentObservation.is_current.is_(True),
                        )
                    )
                ).scalar_one_or_none()

                # Check idempotency
                if existing_obs and existing_obs.snapshot_id == snap_id:
                    # Already ingested from this exact snapshot
                    skipped_count += 1
                    continue

                # Check quality/confidence downgrade
                if existing_obs:
                    current_rank = CONFIDENCE_RANK.get(existing_obs.confidence, 0)
                    new_rank = CONFIDENCE_RANK.get(MetricConfidence(obs.confidence), 0)
                    if new_rank < current_rank:
                        print(
                            f"Skipping {obs.locality_slug} {obs.bhk}: cannot "
                            f"downgrade confidence from {existing_obs.confidence} "
                            f"to {obs.confidence}."
                        )
                        skipped_count += 1
                        continue

                    existing_obs.is_current = False
                    deprecated_count += 1

                new_obs = LocalityRentObservation(
                    locality_id=loc.id,
                    housing_config=HousingConfiguration(obs.bhk),
                    rent_min_inr=obs.rent_min_inr,
                    rent_max_inr=obs.rent_max_inr,
                    confidence=MetricConfidence(obs.confidence),
                    sample_size=prov.sample_count,
                    notes=prov.derivation,
                    snapshot_id=snap_id,
                    is_current=True,
                )
                session.add(new_obs)
                new_count += 1

            await session.commit()
            print(
                f"Success! Inserted {new_count} new observations, "
                f"deprecated {deprecated_count}, skipped {skipped_count}."
            )
        except Exception as e:
            await session.rollback()
            print(f"Fatal execution error during transaction: {e}")
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest Locality Rent Data")
    parser.add_argument("--input", required=True, help="Path to JSON data file")
    parser.add_argument(
        "--dry-run", action="store_true", help="Perform validation without writing to DB"
    )
    args = parser.parse_args()

    asyncio.run(run_ingestion(args.input, args.dry_run))
