"""Locality domain models.

Primary key strategy: integer (BigInteger, auto-increment).

Rationale: Localities are a small, stable reference dataset (target: 30–200 rows
for V1). UUID adds complexity—longer FK columns, worse index locality, harder
debugging—with no concrete benefit in this context. No distributed ID generation
is needed. Integer PKs are consistent with the DataSource/DatasetSnapshot tables.

Geometry design:
  - geometry column: GEOMETRY(GEOMETRY, 4326)
    Using the generic GEOMETRY type (not POLYGON) so PostGIS can store both
    Polygon and MultiPolygon without error. We constrain acceptable types in
    application logic and optionally via a check constraint.
    SRID 4326 (WGS-84) is appropriate for web mapping and geographic functions.
    We store as geometry (not geography) for polygon storage; geography is used
    at query time via ::geography casts for accurate distance calculations.

  - centroid column: GEOMETRY(POINT, 4326)
    Always a single point. Used for ST_Distance comparisons.

  Both columns get GIST spatial indexes for efficient spatial queries.

Geometry provenance / confidence:
  GeometrySource enum records the tier of how we got this geometry.
  GeometryConfidence records our epistemic confidence in that geometry.
  These feed into application decisions about whether to show amenity density.
"""

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
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.observations import LocalityMetric, LocalityRentObservation
    from app.models.provenance import DatasetSnapshot


class GeometrySource(enum.StrEnum):
    """How the locality geometry was obtained.

    These tiers come directly from docs/BENGALURU_GEOGRAPHIC_MODEL.md §4.
    """

    # Polygon matched a well-defined OSM relation/way for this locality
    OSM_POLYGON = "osm_polygon"
    # Point node from OSM — no full polygon available
    OSM_POINT = "osm_point"
    # Human-drawn polygon curated by the blr.life team
    MANUAL_CURATION = "manual_curation"
    # Synthetic circular buffer around a centroid (lowest trust)
    CENTROID_BUFFER = "centroid_buffer"


class GeometryConfidence(enum.StrEnum):
    """Epistemic confidence in this locality's geometry.

    HIGH  → Verified OSM polygon matching the colloquial locality.
    MEDIUM → Curated geometry, or OSM polygon with minor caveats.
    LOW   → Centroid buffer or disputed boundary.
    INSUFFICIENT → No usable geometry exists; centroid only.
    """

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INSUFFICIENT = "insufficient"


class Locality(Base):
    """Canonical blr.life locality — the user-facing neighbourhood concept.

    Represents colloquial Bengaluru localities such as:
      HSR Layout, Koramangala, Indiranagar, Whitefield, Electronic City …

    This is NOT a BBMP ward. It is blr.life's curated, user-mental-model
    aligned canonical place entity.

    Geometry notes:
      geometry: the full polygon/multipolygon area (nullable — a locality may
        be imported with centroid only pending manual curation).
      centroid: a PostGIS POINT derived from the polygon or the canonical OSM
        node. Never null once a locality is active.

    Provenance notes:
      geometry_source and geometry_confidence allow the application and UI to
      decide whether amenity density calculations are trustworthy.
      osm_id and snapshot_id allow the ingestion pipeline to record exactly
      which upstream object produced this geometry.
    """

    __tablename__ = "locality"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ------------------------------------------------------------------
    # Identity
    # ------------------------------------------------------------------

    # Canonical display name, e.g. "HSR Layout"
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # URL-safe lowercase slug, e.g. "hsr-layout"
    slug: Mapped[str] = mapped_column(String(200), nullable=False)

    # Optional parent zone, e.g. "South Bengaluru" — free-form for now.
    # A separate Zone table is not justified in V1.
    parent_zone: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Whether this locality is shown in the product UI
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    # ------------------------------------------------------------------
    # Geometry
    # ------------------------------------------------------------------

    # Full polygon/multipolygon boundary, SRID 4326.
    # Restrict to MULTIPOLYGON for deterministic typing (Polygons coerced on insert).
    # Nullable — may not exist for all localities on initial import.
    geometry: Mapped[bytes | None] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=False),
        nullable=True,
    )

    # Authoritative centroid, SRID 4326.
    # Required for any active locality — distance-based commute calculations
    # depend on it.
    centroid: Mapped[bytes] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Geometry provenance & confidence
    # ------------------------------------------------------------------

    geometry_source: Mapped[GeometrySource | None] = mapped_column(
        Enum(
            GeometrySource,
            name="geometry_source",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )

    geometry_confidence: Mapped[GeometryConfidence | None] = mapped_column(
        Enum(
            GeometryConfidence,
            name="geometry_confidence",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )

    # External source object identifier, e.g. OSM relation/way/node ID string.
    # Stored as string to be source-agnostic (could be "R1234567" or "W987654").
    external_source_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Which import produced this geometry
    geometry_snapshot_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("dataset_snapshot.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ------------------------------------------------------------------
    # Timestamps
    # ------------------------------------------------------------------

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
        UniqueConstraint("slug", name="uq_locality_slug"),
        CheckConstraint("length(trim(name)) > 0", name="ck_locality_name_nonempty"),
        CheckConstraint("length(trim(slug)) > 0", name="ck_locality_slug_nonempty"),
        CheckConstraint("slug = lower(slug)", name="ck_locality_slug_lowercase"),
        # Spatial indexes defined separately below via Index()
        Index("ix_locality_geometry", "geometry", postgresql_using="gist"),
        Index("ix_locality_centroid", "centroid", postgresql_using="gist"),
        Index("ix_locality_is_active", "is_active"),
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    aliases: Mapped[list[LocalityAlias]] = relationship(
        "LocalityAlias",
        back_populates="locality",
        lazy="raise",
        cascade="all, delete-orphan",
    )

    rent_observations: Mapped[list[LocalityRentObservation]] = relationship(
        "LocalityRentObservation",
        back_populates="locality",
        lazy="raise",
        cascade="all, delete-orphan",
    )

    metrics: Mapped[list[LocalityMetric]] = relationship(
        "LocalityMetric",
        back_populates="locality",
        lazy="raise",
        cascade="all, delete-orphan",
    )

    geometry_snapshot: Mapped[DatasetSnapshot | None] = relationship(
        "DatasetSnapshot",
        lazy="raise",
        foreign_keys=[geometry_snapshot_id],
    )

    def __repr__(self) -> str:
        return f"<Locality id={self.id} slug={self.slug!r} active={self.is_active}>"


class LocalityAlias(Base):
    """Alternate names, abbreviations, and search synonyms for a Locality.

    Examples:
      BTM       → BTM Layout
      Koramangla → Koramangala  (common misspelling)
      RR Nagar  → Rajarajeshwari Nagar

    Normalization strategy:
      alias        — stored as-is (original casing preserved for display)
      alias_lower  — application-normalized lowercase for uniqueness checks

    Case-insensitive uniqueness is enforced at the database level via a
    unique constraint on (locality_id, alias_lower). This avoids needing
    pg_trgm or citext extensions, which are not justified for V1.

    FK cascade: If a locality is deleted, its aliases are deleted too.
    """

    __tablename__ = "locality_alias"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    locality_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("locality.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Original alias as entered/curated, e.g. "BTM"
    alias: Mapped[str] = mapped_column(String(200), nullable=False)

    # Application-normalized lowercase for uniqueness, e.g. "btm"
    alias_lower: Mapped[str] = mapped_column(String(200), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        # Global unique: same normalized alias cannot point to two localities
        UniqueConstraint("alias_lower", name="uq_locality_alias_alias_lower"),
        CheckConstraint("length(trim(alias)) > 0", name="ck_locality_alias_alias_nonempty"),
        CheckConstraint(
            "alias_lower = lower(alias_lower)",
            name="ck_locality_alias_alias_lower_lowercase",
        ),
    )

    locality: Mapped[Locality] = relationship(
        "Locality",
        back_populates="aliases",
        lazy="raise",
    )

    def __repr__(self) -> str:
        return f"<LocalityAlias locality_id={self.locality_id} alias={self.alias!r}>"
