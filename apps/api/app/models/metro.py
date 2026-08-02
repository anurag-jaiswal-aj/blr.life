"""Metro station entity models."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.provenance import DatasetSnapshot


class MetroStation(Base):
    """A canonical Bengaluru Namma Metro station.

    Coordinates are stored as PostGIS points (SRID 4326).
    """

    __tablename__ = "metro_station"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Clean display name, e.g., "Indiranagar"
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Unique URL-friendly identifier, e.g. "indiranagar-metro"
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)

    # Original OSM identifier (e.g., node/12345)
    osm_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # Geographic coordinates of the station center
    geometry: Mapped[str] = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=True),
        nullable=False,
        index=True,
    )

    # Which dataset snapshot produced this station record
    snapshot_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("dataset_snapshot.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_metro_station_name_nonempty"),
        CheckConstraint("slug ~ '^[a-z0-9-]+$'", name="ck_metro_station_slug_format"),
        CheckConstraint(
            "osm_id ~ '^(node|way|relation)/\\d+$'", name="ck_metro_station_osm_id_format"
        ),
    )

    snapshot: Mapped[DatasetSnapshot | None] = relationship(
        "DatasetSnapshot",
        lazy="raise",
        foreign_keys=[snapshot_id],
    )

    def __repr__(self) -> str:
        return f"<MetroStation {self.name!r} ({self.slug})>"
