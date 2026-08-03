"""Amenity point-of-interest entity models."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.provenance import DatasetSnapshot


class AmenityCategory(enum.StrEnum):
    """Categorization of amenities for metric calculation."""

    CAFE = "cafe"
    RESTAURANT = "restaurant"
    PARK = "park"
    HEALTHCARE = "healthcare"
    NIGHTLIFE = "nightlife"


class AmenityPOI(Base):
    """A canonical Bengaluru point of interest (amenity).

    Coordinates are stored as PostGIS points (SRID 4326).
    """

    __tablename__ = "amenity_poi"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Optional display name, e.g., "Third Wave Coffee"
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Category of the amenity
    category: Mapped[AmenityCategory] = mapped_column(
        Enum(
            AmenityCategory,
            name="amenity_category",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )

    # Original OSM identifier (e.g., node/12345, way/67890)
    osm_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)

    # Indicates if the POI was present in the latest authoritative snapshot
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true", index=True
    )

    # Geographic coordinates of the POI center
    geometry: Mapped[str] = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=True),
        nullable=False,
        index=True,
    )

    # Which dataset snapshot produced this record
    snapshot_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("dataset_snapshot.id", ondelete="SET NULL"),
        nullable=True,
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
        CheckConstraint(
            "osm_id ~ '^(node|way|relation)/\\d+$'", name="ck_amenity_poi_osm_id_format"
        ),
    )

    snapshot: Mapped[DatasetSnapshot | None] = relationship(
        "DatasetSnapshot",
        lazy="raise",
        foreign_keys=[snapshot_id],
    )

    def __repr__(self) -> str:
        return f"<AmenityPOI {self.category} ({self.osm_id})>"
