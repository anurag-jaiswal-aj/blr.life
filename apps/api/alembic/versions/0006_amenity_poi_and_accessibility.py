"""amenity_poi_and_accessibility

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-03 10:00:00.000000

"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Update metric_type enum
    conn = op.get_bind()
    conn.execute(
        sa.text("ALTER TYPE metric_type RENAME VALUE 'cafe_density' TO 'cafe_accessibility'")
    )
    conn.execute(
        sa.text(
            "ALTER TYPE metric_type RENAME VALUE 'restaurant_density' TO 'restaurant_accessibility'"
        )
    )
    conn.execute(
        sa.text("ALTER TYPE metric_type ADD VALUE IF NOT EXISTS 'nightlife_accessibility'")
    )

    # 2. amenity_category enum definition (creation handled automatically by Column below)
    amenity_category = sa.Enum(
        "cafe",
        "restaurant",
        "park",
        "healthcare",
        "nightlife",
        name="amenity_category",
    )

    # 3. Create amenity_poi table
    op.create_table(
        "amenity_poi",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("category", amenity_category, nullable=False),
        sa.Column("osm_id", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                from_text="ST_GeomFromEWKT",
                name="geometry",
                nullable=False,
            ),
            nullable=False,
        ),
        sa.Column("snapshot_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "osm_id ~ '^(node|way|relation)/\\d+$'", name="ck_amenity_poi_osm_id_format"
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["dataset_snapshot.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("osm_id"),
    )
    op.create_index(op.f("ix_amenity_poi_category"), "amenity_poi", ["category"], unique=False)
    op.create_index(op.f("ix_amenity_poi_is_active"), "amenity_poi", ["is_active"], unique=False)
    op.create_index(op.f("ix_amenity_poi_osm_id"), "amenity_poi", ["osm_id"], unique=False)
    op.create_index(
        op.f("ix_amenity_poi_snapshot_id"), "amenity_poi", ["snapshot_id"], unique=False
    )


def downgrade() -> None:
    # 1. Drop amenity_poi table
    # Note: Explicit op.drop_index calls are removed because op.drop_table
    # cascades and automatically cleans up all associated indexes in PostgreSQL.
    op.drop_table("amenity_poi")

    # 2. Drop amenity_category enum
    sa.Enum(name="amenity_category").drop(op.get_bind())

    # 3. Rename metric_type back
    conn = op.get_bind()
    conn.execute(
        sa.text("ALTER TYPE metric_type RENAME VALUE 'cafe_accessibility' TO 'cafe_density'")
    )
    conn.execute(
        sa.text(
            "ALTER TYPE metric_type RENAME VALUE 'restaurant_accessibility' TO 'restaurant_density'"
        )
    )

    # PG does not support dropping a value from an enum easily.
    # We leave 'nightlife_accessibility' in the enum during downgrade
    # to prevent destructive schema changes.
