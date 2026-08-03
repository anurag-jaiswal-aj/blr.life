import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

from pydantic import ValidationError

from app.core.logging import logger
from app.db.session import AsyncSessionLocal
from app.ingestion.models import IngestPayload
from app.ingestion.pipeline import IngestionError, run_ingestion


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="blr.life data ingestion CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    ingest_parser = subparsers.add_parser("ingest", help="Run a data ingestion payload")
    ingest_parser.add_argument(
        "--file",
        type=str,
        required=True,
        help="Path to the JSON payload file",
    )
    ingest_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run the ingestion process without committing changes to the database",
    )

    ingest_metro_parser = subparsers.add_parser(
        "ingest-metro-data", help="Run a metro data ingestion payload"
    )
    ingest_metro_parser.add_argument(
        "--file",
        type=str,
        required=True,
        help="Path to the JSON payload file",
    )
    ingest_metro_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without committing changes",
    )

    calculate_metro_parser = subparsers.add_parser(
        "calculate-metro-metrics", help="Calculate metro distance metrics"
    )
    calculate_metro_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without committing changes",
    )

    ingest_amenity_parser = subparsers.add_parser(
        "ingest-amenity-data", help="Run an amenity POI data ingestion"
    )
    ingest_amenity_parser.add_argument(
        "--file",
        type=str,
        required=True,
        help="Path to the JSON payload file",
    )
    ingest_amenity_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without committing changes",
    )

    calculate_amenity_parser = subparsers.add_parser(
        "calculate-amenity-metrics", help="Calculate centroid-radius amenity metrics"
    )
    calculate_amenity_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without committing changes",
    )

    return parser.parse_args()


async def ingest_command(file_path: str, dry_run: bool) -> None:
    """Execute the ingest command."""
    path = Path(file_path)
    if not path.is_file():
        logger.error(f"File not found: {file_path}")
        sys.exit(1)

    try:
        with open(path, "rb") as f:
            raw_bytes = f.read()

        raw_data = json.loads(raw_bytes.decode("utf-8"))
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {file_path}: {e}")
        sys.exit(1)

    try:
        payload = IngestPayload.model_validate(raw_data)
        canonical_json_bytes = payload.model_dump_json(serialize_as_any=True).encode("utf-8")
        content_checksum = hashlib.sha256(canonical_json_bytes).hexdigest()
    except ValidationError as e:
        logger.error(f"Payload validation failed: {e}")
        sys.exit(1)

    async with AsyncSessionLocal() as session:
        try:
            stats = await run_ingestion(
                session, payload, dry_run=dry_run, content_checksum=content_checksum
            )

            logger.info("Ingestion completed successfully.")
            logger.info(f"Localities Created: {stats['created']}")
            logger.info(f"Localities Updated: {stats['updated']}")
            logger.info(f"Localities Unchanged: {stats.get('unchanged', 0)}")

            if dry_run:
                logger.info("DRY RUN completed. No changes were committed.")
        except IngestionError as e:
            logger.error(f"Ingestion failed: {e}")
            sys.exit(1)


async def ingest_metro_command(file_path: str, dry_run: bool) -> None:
    from app.ingestion.metro_models import IngestMetroPayload
    from app.ingestion.metro_pipeline import run_metro_ingestion

    path = Path(file_path)
    if not path.is_file():
        logger.error(f"File not found: {file_path}")
        sys.exit(1)

    try:
        with open(path, "rb") as f:
            raw_bytes = f.read()
        raw_data = json.loads(raw_bytes.decode("utf-8"))
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON: {e}")
        sys.exit(1)

    try:
        payload = IngestMetroPayload.model_validate(raw_data)
        content_checksum = hashlib.sha256(
            payload.model_dump_json(serialize_as_any=True).encode("utf-8")
        ).hexdigest()
    except ValidationError as e:
        logger.error(f"Payload validation failed: {e}")
        sys.exit(1)

    async with AsyncSessionLocal() as session:
        try:
            stats = await run_metro_ingestion(
                session, payload, dry_run=dry_run, content_checksum=content_checksum
            )
            logger.info(
                f"Metro ingestion completed. Created: {stats['created']}, "
                f"Updated: {stats['updated']}, Unchanged: {stats.get('unchanged', 0)}, "
                f"Deactivated: {stats.get('deactivated', 0)}"
            )
        except Exception as e:
            logger.error(f"Ingestion failed: {e}")
            sys.exit(1)


async def calculate_metro_metrics_command(dry_run: bool) -> None:
    from app.ingestion.metro_pipeline import calculate_metro_metrics

    async with AsyncSessionLocal() as session:
        try:
            stats = await calculate_metro_metrics(session, dry_run=dry_run)
            logger.info(
                f"Metrics calculation completed. Created: {stats['created']}, "
                f"Updated: {stats['updated']}, Unchanged: {stats.get('unchanged', 0)}"
            )
        except Exception as e:
            logger.error(f"Calculation failed: {e}")
            sys.exit(1)


async def ingest_amenity_command(file_path: str, dry_run: bool) -> None:
    import hashlib

    from app.ingestion.amenity_pipeline import run_amenity_ingestion

    path = Path(file_path)
    if not path.is_file():
        logger.error(f"File not found: {file_path}")
        sys.exit(1)

    try:
        with open(path, "rb") as f:
            raw_bytes = f.read()
    except Exception as e:
        logger.error(f"Failed to read file: {e}")
        sys.exit(1)

    content_checksum = hashlib.sha256(raw_bytes).hexdigest()

    async with AsyncSessionLocal() as session:
        try:
            stats = await run_amenity_ingestion(
                session, file_path, dry_run=dry_run, content_checksum=content_checksum
            )
            logger.info(
                f"Amenity ingestion completed. Created: {stats['created']}, "
                f"Updated: {stats['updated']}, Unchanged: {stats.get('unchanged', 0)}"
            )
        except Exception as e:
            logger.error(f"Ingestion failed: {e}")
            sys.exit(1)


async def calculate_amenity_metrics_command(dry_run: bool) -> None:
    from app.ingestion.amenity_pipeline import calculate_amenity_metrics

    async with AsyncSessionLocal() as session:
        try:
            stats = await calculate_amenity_metrics(session, dry_run=dry_run)
            logger.info(
                f"Amenity metrics calculation completed. Created: {stats['created']}, "
                f"Updated: {stats['updated']}, Unchanged: {stats.get('unchanged', 0)}"
            )
        except Exception as e:
            logger.error(f"Calculation failed: {e}")
            sys.exit(1)


async def main_async() -> None:
    args = parse_args()

    if args.command == "ingest":
        await ingest_command(file_path=args.file, dry_run=args.dry_run)
    elif args.command == "ingest-metro-data":
        await ingest_metro_command(file_path=args.file, dry_run=args.dry_run)
    elif args.command == "calculate-metro-metrics":
        await calculate_metro_metrics_command(dry_run=args.dry_run)
    elif args.command == "ingest-amenity-data":
        await ingest_amenity_command(file_path=args.file, dry_run=args.dry_run)
    elif args.command == "calculate-amenity-metrics":
        await calculate_amenity_metrics_command(dry_run=args.dry_run)


def main() -> None:
    """Entry point for the CLI script."""
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
