import argparse
import asyncio
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

    return parser.parse_args()


async def ingest_command(file_path: str, dry_run: bool) -> None:
    """Execute the ingest command."""
    path = Path(file_path)
    if not path.is_file():
        logger.error(f"File not found: {file_path}")
        sys.exit(1)

    try:
        with open(path, encoding="utf-8") as f:
            raw_data = json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {file_path}: {e}")
        sys.exit(1)

    try:
        payload = IngestPayload.model_validate(raw_data)
    except ValidationError as e:
        logger.error(f"Payload validation failed: {e}")
        sys.exit(1)

    async with AsyncSessionLocal() as session:
        try:
            stats = await run_ingestion(session, payload, dry_run=dry_run)
            
            logger.info("Ingestion completed successfully.")
            logger.info(f"Localities Created: {stats['created']}")
            logger.info(f"Localities Updated: {stats['updated']}")
            
            if dry_run:
                logger.info("DRY RUN completed. No changes were committed.")
        except IngestionError as e:
            logger.error(f"Ingestion failed: {e}")
            sys.exit(1)


async def main_async() -> None:
    args = parse_args()

    if args.command == "ingest":
        await ingest_command(file_path=args.file, dry_run=args.dry_run)


def main() -> None:
    """Entry point for the CLI script."""
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
