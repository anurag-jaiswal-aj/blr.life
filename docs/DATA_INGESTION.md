# Data Ingestion Pipeline

blr.life uses an offline, reproducible data ingestion pipeline to safely update the canonical Bengaluru locality dataset. This pipeline is separated from the production API to ensure that data anomalies are caught early, and transaction safety is guaranteed during large imports.

## Architecture

The ingestion pipeline is located in `apps/api/app/ingestion/`.
It relies on a **JSON** payload containing localities and their geometries (in WKT format).

### Validation and Normalization
1. **Pydantic Validation**: All incoming data is first parsed and strictly validated by Pydantic (`IngestPayload`, `IngestLocality`, `IngestLocalityAlias`) before any database operations occur. `geometry_wkt` is strictly validated to ensure it is a `POLYGON` or `MULTIPOLYGON`, while `centroid_wkt` must be a `POINT`.
2. **Standardization**: Slugs must be predefined in the JSON, but alias normalization occurs during DB insertion (e.g., lowercasing an alias to ensure case-insensitive uniqueness constraints).

### Transaction Lifecycle
1. The entire ingestion file is processed in a **single database transaction**.
2. First, the pipeline verifies the existence of the `DataSource` using the provided `data_source_key`.
3. A `DatasetSnapshot` is created or reused. The identity of a snapshot is strictly defined by the combination of `data_source_id` and `source_version`. If a snapshot with the exact same data source and upstream version exists, it is reused and updated; otherwise, a new snapshot is created.
4. Localities are inserted. If a locality with the same `slug` exists, an **UPSERT** occurs (`ON CONFLICT DO UPDATE`), replacing its details but preserving its ID.
5. Aliases are similarly upserted.
6. Once completed, the `DatasetSnapshot` is marked as `COMPLETED`.
7. If an error occurs, the transaction is **rolled back**, leaving the database in its prior state.

### Idempotency
Because we rely on `slug` (for localities) and `alias_lower` (for aliases) as unique constraints, running the exact same ingestion file twice is completely safe. The second run will simply update all fields to the exact same values, resulting in zero new created items and avoiding duplicate geometry entries.

## Usage

You can run the ingestion CLI using the Python module, but the recommended approach is using the provided `Makefile` commands to ensure it runs against the correct test database (to avoid polluting production or development databases during testing).

```bash
# From the repository root
make ingest-synthetic
```

If you wish to run it manually using the CLI:


```bash
cd apps/api
uv run python -m app.ingestion.cli ingest --file <path_to_payload.json>
```

### Dry Runs
To safely check if an ingestion file parses correctly and see how many items would be created or updated without committing to the database, use the `--dry-run` flag via the Makefile canonical command:

```bash
make ingest-synthetic-dry-run
```

Or manually:

```bash
uv run python -m app.ingestion.cli ingest --file data.json --dry-run
```

## Testing

A synthetic test fixture exists at `apps/api/tests/fixtures/synthetic_ingestion.json` featuring fictional locations. The integration tests (`test_ingestion.py`) run against this fixture to verify database behaviors like transaction rollback, idempotency, and UPSERT logic.
