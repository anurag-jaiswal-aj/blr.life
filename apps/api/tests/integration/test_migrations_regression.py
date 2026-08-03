import os
from pathlib import Path

import pytest
import sqlalchemy.exc
from alembic.config import Config
from sqlalchemy import text

from alembic import command
from app.models.base import Base

ALEMBIC_DIR = Path(__file__).parent.parent.parent
ALEMBIC_INI = ALEMBIC_DIR / "alembic.ini"


@pytest.fixture
def alembic_config() -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(ALEMBIC_DIR / "alembic"))
    # Ensure it uses the test database URL but synchronous (psycopg instead of asyncpg)
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://blrlife:blrlife_dev_password@localhost:5432/blrlife_test"
    )
    sync_url = url.replace("+asyncpg", "+psycopg").replace("blrlife_test", "blrlife_test_migrations")
    config.set_main_option("sqlalchemy.url", sync_url)
    
    # We must patch os.environ and settings because env.py reads settings.DATABASE_URL
    # and settings is cached in sys.modules
    from app.core.config import settings
    original_url = os.environ.get("DATABASE_URL")
    original_settings_url = settings.DATABASE_URL
    os.environ["DATABASE_URL"] = sync_url.replace("+psycopg", "+asyncpg")
    settings.DATABASE_URL = sync_url.replace("+psycopg", "+asyncpg")
    yield config
    if original_url:
        os.environ["DATABASE_URL"] = original_url
    else:
        del os.environ["DATABASE_URL"]
    settings.DATABASE_URL = original_settings_url


def test_migration_0006_roundtrip_and_constraints(alembic_config: Config) -> None:
    """
    Ensures that the 0006 migration correctly round-trips (downgrade bug)
    and that the OSM ID constraint functions correctly in the real schema (regex bug).
    """
    from sqlalchemy import create_engine

    admin_url = alembic_config.get_main_option("sqlalchemy.url").replace("blrlife_test_migrations", "blrlife")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    
    with admin_engine.begin() as conn:
        conn.execute(text("DROP DATABASE IF EXISTS blrlife_test_migrations WITH (FORCE);"))
        conn.execute(text("CREATE DATABASE blrlife_test_migrations;"))

    engine = create_engine(alembic_config.get_main_option("sqlalchemy.url"))

    # 2. Upgrade to head
    command.upgrade(alembic_config, "head")

    # 3. Test OSM ID Constraint on the actual Alembic schema
    with engine.begin() as conn:
        # Test valid insertions (should pass)
        conn.execute(
            text(
                "INSERT INTO amenity_poi (name, category, osm_id, is_active, geometry) "
                "VALUES ('Test', 'cafe', 'node/111', true, ST_GeomFromEWKT('SRID=4326;POINT(0 0)'))"
            )
        )
        conn.execute(
            text(
                "INSERT INTO amenity_poi (name, category, osm_id, is_active, geometry) "
                "VALUES ('Test', 'park', 'way/222', true, ST_GeomFromEWKT('SRID=4326;POINT(0 0)'))"
            )
        )
        conn.execute(
            text(
                "INSERT INTO amenity_poi (name, category, osm_id, is_active, geometry) "
                "VALUES ('Test', 'nightlife', 'relation/333', true, ST_GeomFromEWKT('SRID=4326;POINT(0 0)'))"  # noqa: E501
            )
        )

        # Test invalid insertion (should fail due to regex constraint)
        invalid_ids = ["foo/111", "node/foo", "node/", "node/abc", "111", "node/-1"]
        for invalid_id in invalid_ids:
            try:
                with conn.begin_nested():
                    conn.execute(
                        text(
                            "INSERT INTO amenity_poi (name, category, osm_id, is_active, geometry) "  # noqa: E501
                            "VALUES ('Fail', 'cafe', :osm_id, true, ST_GeomFromEWKT('SRID=4326;POINT(0 0)'))"  # noqa: E501
                        ),
                        {"osm_id": invalid_id},
                    )
                pytest.fail(f"Invalid OSM ID {invalid_id} was accepted")
            except sqlalchemy.exc.IntegrityError as e:
                assert "ck_amenity_poi" in str(e) or "check constraint" in str(e).lower()

    # 4. Downgrade to 0005 (ensures index dropping doesn't crash)
    command.downgrade(alembic_config, "0005")

    # 5. Upgrade back to head (proves round-trip stability)
    command.upgrade(alembic_config, "head")

    # Clean up again for subsequent tests and restore the SQLAlchemy schema
    engine.dispose()
    with admin_engine.begin() as conn:
        conn.execute(text("DROP DATABASE IF EXISTS blrlife_test_migrations WITH (FORCE);"))
    admin_engine.dispose()
