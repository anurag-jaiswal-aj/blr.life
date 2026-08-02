"""enable postgis extension

Revision ID: 0001_enable_postgis
Revises:
Create Date: 2026-08-02 10:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001_enable_postgis"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enable PostGIS extension for geospatial operations
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")


def downgrade() -> None:
    # Intentionally not dropping postgis extension on downgrade
    # because dropping postgis cascade-drops dependent spatial types/tables in production.
    pass
