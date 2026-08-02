"""Integration tests for the domain schema against a live PostgreSQL/PostGIS database.
# ruff: noqa: E501, B017


SAFETY: These tests operate on an isolated 'blrlife_test' database that is
separate from the development 'blrlife' database. The test DB is created and
migrated on first run, then used for all test sessions.

Running:
  make test-integration

or directly:
  cd apps/api && uv run pytest tests/integration/ -v

The TEST_DB_URL environment variable can be set to override the default.
"""

import os
from decimal import Decimal

import pytest
import sqlalchemy as sa
from sqlalchemy import text

from app.models import (
    Base,
)

# ---------------------------------------------------------------------------
# Test database URL
# ---------------------------------------------------------------------------
_TEST_PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
_TEST_PG_PORT = os.getenv("POSTGRES_PORT", "5432")
_TEST_PG_USER = os.getenv("POSTGRES_USER", "blrlife")
_TEST_PG_PASSWORD = os.getenv("POSTGRES_PASSWORD", "blrlife_dev_password")
_TEST_DB_NAME = "blrlife_test"

TEST_ASYNC_URL = os.getenv(
    "TEST_DB_URL",
    f"postgresql+asyncpg://{_TEST_PG_USER}:{_TEST_PG_PASSWORD}"
    f"@{_TEST_PG_HOST}:{_TEST_PG_PORT}/{_TEST_DB_NAME}",
)
TEST_SYNC_URL = TEST_ASYNC_URL.replace("postgresql+asyncpg://", "postgresql+psycopg://")
ADMIN_SYNC_URL = TEST_SYNC_URL.replace(f"/{_TEST_DB_NAME}", "/blrlife")

# ---------------------------------------------------------------------------
# Session-scoped: create test DB, create enums, create tables
# ---------------------------------------------------------------------------

_ENUM_DEFINITIONS = [
    ("source_status", "'active', 'deprecated'"),
    ("snapshot_status", "'pending', 'completed', 'failed', 'partial'"),
    ("geometry_source", "'osm_polygon', 'osm_point', 'manual_curation', 'centroid_buffer'"),
    ("geometry_confidence", "'high', 'medium', 'low', 'insufficient'"),
    ("housing_configuration", "'1rk', '1bhk', '2bhk', '3bhk'"),
    ("metric_confidence", "'high', 'medium', 'low', 'insufficient'"),
    (
        "metric_type",
        "'cafe_density', 'restaurant_density', 'park_accessibility', "
        "'healthcare_accessibility', 'metro_distance_m', "
        "'metro_walk_distance_m', 'amenity_composite'",
    ),
]


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():  # type: ignore[return]
    """Create and migrate the test database once per session."""
    # Create the test database if it doesn't exist
    admin_engine = sa.create_engine(ADMIN_SYNC_URL, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        row = conn.execute(
            text(f"SELECT 1 FROM pg_database WHERE datname='{_TEST_DB_NAME}'")
        ).fetchone()
        if not row:
            conn.execute(text(f'CREATE DATABASE "{_TEST_DB_NAME}"'))
    admin_engine.dispose()

    # Set up schema in the test database
    test_engine = sa.create_engine(TEST_SYNC_URL)
    with test_engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()
        # Create enums that don't exist (PostgreSQL has no CREATE TYPE IF NOT EXISTS)
        for enum_name, values in _ENUM_DEFINITIONS:
            conn.execute(
                text(
                    f"DO $$ BEGIN "
                    f"  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='{enum_name}') THEN "
                    f"    CREATE TYPE {enum_name} AS ENUM ({values}); "
                    f"  END IF; "
                    f"END $$"
                )
            )
        conn.commit()
        Base.metadata.create_all(conn)
        conn.commit()
    test_engine.dispose()

    yield

    # Teardown: drop all domain tables
    test_engine = sa.create_engine(TEST_SYNC_URL)
    with test_engine.connect() as conn:
        Base.metadata.drop_all(conn)
        conn.commit()
        for enum_name, _ in reversed(_ENUM_DEFINITIONS):
            conn.execute(text(f"DROP TYPE IF EXISTS {enum_name}"))
        conn.commit()
    test_engine.dispose()


@pytest.fixture(scope="session")
def sync_engine():  # type: ignore[no-untyped-def]
    engine = sa.create_engine(TEST_SYNC_URL)
    yield engine
    engine.dispose()


@pytest.fixture
def db(sync_engine):  # type: ignore[no-untyped-def]
    """Provide a synchronous DB connection that rolls back after each test."""
    with sync_engine.connect() as conn:
        conn.begin_nested()  # savepoint
        yield conn
        conn.rollback()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_POINT_WKT = "SRID=4326;POINT(77.6411 12.9141)"
SAMPLE_POLYGON_WKT = (
    "SRID=4326;POLYGON((77.63 12.91, 77.65 12.91, 77.65 12.93, 77.63 12.93, 77.63 12.91))"
)

_slug_counter = 0


def _unique_slug(prefix: str) -> str:
    global _slug_counter
    _slug_counter += 1
    return f"{prefix}-{_slug_counter}"


def _insert_locality(conn, slug: str, name: str = "Test Locality") -> int:
    result = conn.execute(
        text(
            "INSERT INTO locality (name, slug, is_active, centroid) VALUES (:name, :slug, true, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)) RETURNING id"  # noqa: E501
        ),
        {"name": name, "slug": slug},
    )
    return result.scalar_one()


def _insert_source(conn, key: str = "test-source") -> int:
    result = conn.execute(
        text(
            "INSERT INTO data_source (key, display_name, status) "
            "VALUES (:key, 'Test Source', 'active') RETURNING id"
        ),
        {"key": key},
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Tests: Schema structural checks
# ---------------------------------------------------------------------------


class TestSchemaStructure:
    def test_all_tables_exist(self, db) -> None:  # type: ignore[no-untyped-def]
        result = db.execute(
            text(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname='public' AND tablename IN ("
                "'data_source','dataset_snapshot','locality',"
                "'locality_alias','locality_rent_observation','locality_metric')"
            )
        )
        tables = {r[0] for r in result.fetchall()}
        assert tables == {
            "data_source",
            "dataset_snapshot",
            "locality",
            "locality_alias",
            "locality_rent_observation",
            "locality_metric",
        }

    def test_spatial_gist_indexes_exist(self, db) -> None:  # type: ignore[no-untyped-def]
        result = db.execute(
            text(
                "SELECT indexname FROM pg_indexes "
                "WHERE tablename='locality' AND indexdef LIKE '%gist%'"
            )
        )
        idxs = {r[0] for r in result.fetchall()}
        assert "ix_locality_geometry" in idxs
        assert "ix_locality_centroid" in idxs

    def test_geometry_columns_have_correct_srid(self, db) -> None:  # type: ignore[no-untyped-def]
        result = db.execute(
            text(
                "SELECT f_geometry_column, srid FROM geometry_columns WHERE f_table_name='locality'"  # noqa: E501
            )
        )
        rows = {r[0]: r[1] for r in result.fetchall()}
        # Both geometry and centroid should have SRID 4326
        for col in ("geometry", "centroid"):
            assert rows.get(col) == 4326, f"Expected SRID 4326 for {col}, got {rows.get(col)}"

    def test_all_enums_created(self, db) -> None:  # type: ignore[no-untyped-def]
        result = db.execute(
            text(
                "SELECT typname FROM pg_type "
                "WHERE typtype='e' AND typname IN ("
                "'source_status','snapshot_status','geometry_source',"
                "'geometry_confidence','housing_configuration',"
                "'metric_confidence','metric_type')"
            )
        )
        types = {r[0] for r in result.fetchall()}
        assert len(types) == 7


# ---------------------------------------------------------------------------
# Tests: DataSource
# ---------------------------------------------------------------------------


class TestDataSource:
    def test_create_data_source(self, db) -> None:  # type: ignore[no-untyped-def]
        sid = _insert_source(db, "osm-test-src")
        assert sid is not None
        row = db.execute(
            text("SELECT key, status FROM data_source WHERE id=:id"), {"id": sid}
        ).fetchone()
        assert row[0] == "osm-test-src"
        assert row[1] == "active"

    def test_duplicate_key_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        _insert_source(db, "dup-src-key")
        with pytest.raises(sa.exc.SQLAlchemyError):
            _insert_source(db, "dup-src-key")

    def test_empty_key_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO data_source (key, display_name, status) VALUES (:k, 'X', 'active')"  # noqa: E501
                ),
                {"k": "   "},
            )


# ---------------------------------------------------------------------------
# Tests: Locality
# ---------------------------------------------------------------------------


class TestLocality:
    def test_create_locality_minimal(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("loc-min"))
        assert lid is not None

    def test_duplicate_slug_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        slug = _unique_slug("slug-dup")
        _insert_locality(db, slug)
        with pytest.raises(sa.exc.SQLAlchemyError):
            _insert_locality(db, slug)

    def test_empty_name_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text("INSERT INTO locality (name, slug, is_active) VALUES (:n, :s, true)"),
                {"n": "   ", "s": _unique_slug("empty-name")},
            )

    def test_uppercase_slug_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text("INSERT INTO locality (name, slug, is_active) VALUES (:n, :s, true)"),
                {"n": "Test", "s": "Uppercase-Slug"},
            )

    def test_locality_with_point_geometry(self, db) -> None:  # type: ignore[no-untyped-def]
        slug = _unique_slug("point-geom")
        db.execute(
            text(
                "INSERT INTO locality (name, slug, is_active, centroid, geometry_source, geometry_confidence) "  # noqa: E501
                "VALUES (:n, :s, true, ST_GeomFromEWKT(:c), 'osm_point'::geometry_source, 'medium'::geometry_confidence)"  # noqa: E501
            ),
            {"n": "Point Locality", "s": slug, "c": SAMPLE_POINT_WKT},
        )
        row = db.execute(
            text("SELECT ST_SRID(centroid) FROM locality WHERE slug=:s"), {"s": slug}
        ).scalar()
        assert row == 4326

    def test_locality_with_polygon_geometry(self, db) -> None:  # type: ignore[no-untyped-def]
        slug = _unique_slug("poly-geom")
        db.execute(
            text(
                "INSERT INTO locality (name, slug, is_active, geometry, centroid, geometry_source, geometry_confidence) "  # noqa: E501
                "VALUES (:n, :s, true, ST_GeomFromEWKT(:g), ST_GeomFromEWKT(:c), "
                "'osm_polygon'::geometry_source, 'high'::geometry_confidence)"
            ),
            {"n": "Poly Locality", "s": slug, "g": SAMPLE_POLYGON_WKT, "c": SAMPLE_POINT_WKT},
        )
        row = db.execute(
            text("SELECT ST_GeometryType(geometry) FROM locality WHERE slug=:s"), {"s": slug}
        ).scalar()
        assert row in ("ST_Polygon", "ST_MultiPolygon")


# ---------------------------------------------------------------------------
# Tests: LocalityAlias
# ---------------------------------------------------------------------------


class TestLocalityAlias:
    def test_create_alias(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("alias-base"))
        db.execute(
            text(
                "INSERT INTO locality_alias (locality_id, alias, alias_lower) VALUES (:lid, :a, :al)"  # noqa: E501
            ),
            {"lid": lid, "a": "BTM", "al": "btm"},
        )
        count = db.execute(
            text("SELECT count(*) FROM locality_alias WHERE locality_id=:lid"), {"lid": lid}
        ).scalar()
        assert count == 1

    def test_duplicate_normalized_alias_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("alias-dup"))
        db.execute(
            text(
                "INSERT INTO locality_alias (locality_id, alias, alias_lower) VALUES (:lid, 'BTM', 'btm')"  # noqa: E501
            ),
            {"lid": lid},
        )
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO locality_alias (locality_id, alias, alias_lower) VALUES (:lid, 'btm', 'btm')"  # noqa: E501
                ),
                {"lid": lid},
            )

    def test_alias_lower_must_be_lowercase(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("alias-case"))
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO locality_alias (locality_id, alias, alias_lower) VALUES (:lid, 'BTM', 'BTM')"  # noqa: E501
                ),
                {"lid": lid},
            )

    def test_alias_cascade_delete_with_locality(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("alias-cascade"))
        db.execute(
            text(
                "INSERT INTO locality_alias (locality_id, alias, alias_lower) VALUES (:lid, 'X', 'x')"  # noqa: E501
            ),
            {"lid": lid},
        )
        db.execute(text("DELETE FROM locality WHERE id=:lid"), {"lid": lid})
        count = db.execute(
            text("SELECT count(*) FROM locality_alias WHERE locality_id=:lid"), {"lid": lid}
        ).scalar()
        assert count == 0


# ---------------------------------------------------------------------------
# Tests: LocalityRentObservation
# ---------------------------------------------------------------------------


class TestLocalityRentObservation:
    def test_valid_rent_observation(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("rent-valid"))
        db.execute(
            text(
                "INSERT INTO locality_rent_observation "
                "(locality_id, housing_config, rent_min_inr, rent_max_inr, confidence, currency_code, is_current) "  # noqa: E501
                "VALUES (:lid, '1bhk'::housing_configuration, 18000, 25000, 'low'::metric_confidence, 'INR', true)"  # noqa: E501
            ),
            {"lid": lid},
        )
        count = db.execute(
            text("SELECT count(*) FROM locality_rent_observation WHERE locality_id=:lid"),
            {"lid": lid},
        ).scalar()
        assert count == 1

    def test_negative_rent_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("rent-neg"))
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO locality_rent_observation "
                    "(locality_id, housing_config, rent_min_inr, confidence, is_current) "
                    "VALUES (:lid, '1bhk'::housing_configuration, -1000, 'low'::metric_confidence, true)"  # noqa: E501
                ),
                {"lid": lid},
            )

    def test_min_greater_than_max_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("rent-minmax"))
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO locality_rent_observation "
                    "(locality_id, housing_config, rent_min_inr, rent_max_inr, confidence, is_current) "  # noqa: E501
                    "VALUES (:lid, '1bhk'::housing_configuration, 30000, 20000, 'low'::metric_confidence, true)"  # noqa: E501
                ),
                {"lid": lid},
            )

    def test_null_rents_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("rent-null"))
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO locality_rent_observation "
                    "(locality_id, housing_config, confidence, is_current, rent_min_inr) "
                    "VALUES (:lid, '2bhk'::housing_configuration, 'insufficient'::metric_confidence, true, NULL)"  # noqa: E501
                ),
                {"lid": lid},
            )
        # Check should fail anyway as rent_min_inr is NOT NULL
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO locality_rent_observation "
                    "(locality_id, housing_config, confidence, is_current) "
                    "VALUES (:lid, '2bhk'::housing_configuration, 'insufficient'::metric_confidence, true)"  # noqa: E501
                ),
                {"lid": lid},
            )

    def test_invalid_sample_size_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("rent-sample"))
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO locality_rent_observation "
                    "(locality_id, housing_config, sample_size, confidence, is_current) "
                    "VALUES (:lid, '1bhk'::housing_configuration, 0, 'low'::metric_confidence, true)"  # noqa: E501
                ),
                {"lid": lid},
            )


# ---------------------------------------------------------------------------
# Tests: LocalityMetric
# ---------------------------------------------------------------------------


class TestLocalityMetric:
    def test_valid_metric(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("metric-valid"))
        db.execute(
            text(
                "INSERT INTO locality_metric "
                "(locality_id, metric_type, value, calc_version, calculated_at, confidence, is_current) "  # noqa: E501
                "VALUES (:lid, 'cafe_density'::metric_type, 8.2500, 'cafe-density-v1', now(), 'medium'::metric_confidence, true)"  # noqa: E501
            ),
            {"lid": lid},
        )
        row = db.execute(
            text("SELECT value FROM locality_metric WHERE locality_id=:lid"), {"lid": lid}
        ).scalar()
        assert Decimal(str(row)) == Decimal("8.2500")

    def test_duplicate_version_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("metric-dup"))

        # Need to insert a dataset snapshot first to make snapshot_id non-null
        # Otherwise, Postgres treats NULL != NULL in unique constraints.
        ds_id = _insert_source(db, _unique_slug("src-dup"))
        db.execute(
            text(
                "INSERT INTO dataset_snapshot (data_source_id, source_version, retrieved_at, status) "  # noqa: E501
                "VALUES (:ds_id, 'snapshot-dup', now(), 'pending'::snapshot_status)"
            ),
            {"ds_id": ds_id},
        )
        snap_id = db.execute(
            text("SELECT id FROM dataset_snapshot WHERE source_version = 'snapshot-dup'")
        ).scalar_one()  # noqa: E501

        db.execute(
            text(
                "INSERT INTO locality_metric "
                "(locality_id, metric_type, value, calc_version, calculated_at, confidence, is_current, snapshot_id) "  # noqa: E501
                "VALUES (:lid, 'metro_distance_m'::metric_type, 1500, 'metro-dist-v1', now(), 'high'::metric_confidence, true, :snap_id)"  # noqa: E501
            ),
            {"lid": lid, "snap_id": snap_id},
        )
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO locality_metric "
                    "(locality_id, metric_type, value, calc_version, calculated_at, confidence, is_current, snapshot_id) "  # noqa: E501
                    "VALUES (:lid, 'metro_distance_m'::metric_type, 1600, 'metro-dist-v1', now(), 'high'::metric_confidence, true, :snap_id)"  # noqa: E501
                ),
                {"lid": lid, "snap_id": snap_id},
            )

    def test_empty_calc_version_rejected(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("metric-ver"))
        with pytest.raises(sa.exc.SQLAlchemyError):
            db.execute(
                text(
                    "INSERT INTO locality_metric "
                    "(locality_id, metric_type, value, calc_version, calculated_at, confidence, is_current) "  # noqa: E501
                    "VALUES (:lid, 'park_accessibility'::metric_type, 3.0, '   ', now(), 'medium'::metric_confidence, true)"  # noqa: E501
                ),
                {"lid": lid},
            )

    def test_numeric_precision(self, db) -> None:  # type: ignore[no-untyped-def]
        lid = _insert_locality(db, _unique_slug("metric-precision"))
        db.execute(
            text(
                "INSERT INTO locality_metric "
                "(locality_id, metric_type, value, calc_version, calculated_at, confidence, is_current) "  # noqa: E501
                "VALUES (:lid, 'restaurant_density'::metric_type, 12.3456, 'rest-density-v1', now(), 'medium'::metric_confidence, true)"  # noqa: E501
            ),
            {"lid": lid},
        )
        stored = db.execute(
            text("SELECT value FROM locality_metric WHERE locality_id=:lid"), {"lid": lid}
        ).scalar()
        assert Decimal(str(stored)) == Decimal("12.3456")
