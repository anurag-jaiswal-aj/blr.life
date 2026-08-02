"""Alembic environment configuration.

Uses synchronous psycopg for migrations (standard Alembic pattern).
The application runtime uses asyncpg; migrations run outside the event loop.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from logging.config import fileConfig

from sqlalchemy import create_engine, pool

import app.models  # noqa: F401 — registers all models on Base.metadata
from alembic import context
from app.core.config import settings
from app.models.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_name(name, type_, parent_names):
    if type_ == "table":
        if name in (
            "spatial_ref_sys",
            "geometry_columns",
            "geography_columns",
            "layer",
            "topology",
            "pagc_rules",
            "pagc_lex",
            "pagc_gaz",
            "loader_platform",
            "loader_variables",
            "loader_lookuptables",
            "geocode_settings",
            "geocode_settings_default",
            "direction_lookup",
            "secondary_unit_lookup",
            "state_lookup",
            "county_lookup",
            "place_lookup",
            "countysub_lookup",
            "street_type_lookup",
            "zip_lookup",
            "zip_lookup_base",
            "zip_lookup_all",
            "zip_state",
            "zip_state_loc",
            "state",
            "county",
            "cousub",
            "place",
            "tract",
            "bg",
            "tabblock",
            "tabblock20",
            "zcta5",
            "faces",
            "edges",
            "addrfeat",
            "addr",
            "featnames",
        ):
            return False
    return True


_db_url: str = settings.DATABASE_URL or config.get_main_option("sqlalchemy.url", "")
_sync_url = _db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
config.set_main_option("sqlalchemy.url", _sync_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_name=include_name,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_sync_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_name=include_name,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
