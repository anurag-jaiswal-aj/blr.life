"""Observation models: rent observations and derived locality metrics.

Currency design (rent):
  Monthly INR residential rent is stored as INTEGER (whole rupees).
  Reasoning: Python Decimal and PostgreSQL NUMERIC add complexity that
  is not justified for coarse rent bands with LOW confidence. Whole rupees
  are sufficient. We never display or calculate fractional rupees.
  Any future financial precision requirement (e.g. tax calculations)
  should use NUMERIC at that point.

  Currency is fixed to INR for V1; a currency_code column is retained
  for future extensibility but defaults to 'INR'.

Metric value design:
  LocalityMetric values use NUMERIC(10, 4) — PostgreSQL fixed-point
  decimal with 4 decimal places. This avoids float rounding errors for
  density values (e.g. 12.3456 cafés/km²). Not all metrics need this
  precision, but a consistent column type simplifies schema queries.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.locality import Locality
    from app.models.provenance import DatasetSnapshot


class HousingConfiguration(enum.StrEnum):
    """Controlled vocabulary for residential housing unit types in India."""

    RK_1 = "1rk"  # single room with kitchen
    BHK_1 = "1bhk"
    BHK_2 = "2bhk"
    BHK_3 = "3bhk"


class MetricConfidence(enum.StrEnum):
    """Epistemic confidence in a derived metric value.

    HIGH  → Objective, deterministic (e.g. straight-line distance to Metro).
    MEDIUM → Computed from incomplete but usable data (e.g. OSM amenity density
             where mapping coverage is variable).
    LOW   → Estimated, sparse, or uncertain (e.g. rent bands from reports).
    INSUFFICIENT → Insufficient data; metric should not influence scoring.
    """

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INSUFFICIENT = "insufficient"


class MetricType(enum.StrEnum):
    """Controlled set of precomputed locality metric types.

    Adding a new metric type requires a code change and migration (to add
    the enum value). This is intentional: we prevent arbitrary metric key
    proliferation and ensure each type has a documented semantic meaning.
    """

    # Count of cafe amenities within locality boundary or centroid radius
    CAFE_DENSITY = "cafe_density"
    # Count of restaurant amenities within locality boundary
    RESTAURANT_DENSITY = "restaurant_density"
    # Count of park amenities / green space access
    PARK_ACCESSIBILITY = "park_accessibility"
    # Count of hospital/clinic amenities
    HEALTHCARE_ACCESSIBILITY = "healthcare_accessibility"
    # Distance in metres to the nearest Namma Metro station centroid
    METRO_DISTANCE_M = "metro_distance_m"
    # Distance in metres to nearest Metro station (walking network)
    # Reserved for future use when routing engine is available
    METRO_WALK_DISTANCE_M = "metro_walk_distance_m"
    # General neighbourhood amenity composite (future derived metric)
    AMENITY_COMPOSITE = "amenity_composite"


class LocalityRentObservation(Base):
    """A coarse, low-confidence rent band observation for a locality.

    V1 rent data is approximate. We store optional min/max rent to represent
    bands (e.g. ₹18,000–₹28,000 for 1BHK in HSR Layout) rather than fake
    point estimates.

    Both rent_min_inr and rent_max_inr are optional independently, but
    a CHECK constraint requires that if both are set, min <= max.

    Do not seed with real production rent numbers in this work unit.
    """

    __tablename__ = "locality_rent_observation"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    locality_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("locality.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    housing_config: Mapped[HousingConfiguration] = mapped_column(
        Enum(
            HousingConfiguration,
            name="housing_configuration",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )

    # Monthly rent in whole INR. Nullable because we may know a band exists
    # without precise bounds.
    rent_min_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rent_max_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Currency code for future extensibility; INR for V1
    currency_code: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="INR",
        server_default="INR",
    )

    # When this rent range was observed / collected
    observed_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Which dataset snapshot produced this observation
    snapshot_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("dataset_snapshot.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    confidence: Mapped[MetricConfidence] = mapped_column(
        Enum(
            MetricConfidence,
            name="metric_confidence",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )

    # Number of listings or reports this range is based on; null if unknown
    sample_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Human-readable notes about the source, e.g. "Based on 2025-Q1 market report"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # If True, this is the latest/preferred observation for this locality+config
    is_current: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint("rent_min_inr >= 0", name="ck_locality_rent_observation_rent_min_nonneg"),
        CheckConstraint("rent_max_inr >= 0", name="ck_locality_rent_observation_rent_max_nonneg"),
        CheckConstraint(
            "rent_min_inr IS NOT NULL OR rent_max_inr IS NOT NULL",
            name="ck_locality_rent_observation_has_bound",
        ),
        CheckConstraint(
            "rent_min_inr IS NULL OR rent_max_inr IS NULL OR rent_min_inr <= rent_max_inr",
            name="ck_locality_rent_observation_min_lte_max",
        ),
        CheckConstraint(
            "sample_size IS NULL OR sample_size > 0",
            name="ck_locality_rent_observation_sample_positive",
        ),
        CheckConstraint(
            "length(trim(currency_code)) = 3", name="ck_locality_rent_observation_currency_len"
        ),
        Index(
            "ix_locality_rent_observation_locality_id_housing_config",
            "locality_id",
            "housing_config",
        ),
    )

    locality: Mapped[Locality] = relationship(
        "Locality",
        back_populates="rent_observations",
        lazy="raise",
    )

    snapshot: Mapped[DatasetSnapshot | None] = relationship(
        "DatasetSnapshot",
        lazy="raise",
        foreign_keys=[snapshot_id],
    )

    def __repr__(self) -> str:
        return (
            f"<LocalityRentObservation locality_id={self.locality_id} "
            f"config={self.housing_config} range=[{self.rent_min_inr},{self.rent_max_inr}]>"
        )


class LocalityMetric(Base):
    """A precomputed locality-level metric from the offline data pipeline.

    Examples of what ends up here:
      locality=HSR Layout, metric=cafe_density, value=8.2500 (cafés/km²)
      locality=Bellandur,  metric=metro_distance_m, value=3200.0000

    Constraint: one row per (locality_id, metric_type, calc_version).
    This lets us retain historical versions of a metric while the app uses
    the latest. The unique constraint on (locality_id, metric_type, calc_version)
    prevents duplicate metric rows.

    Metric value is NUMERIC(12, 4) — handles counts, densities, distances in
    metres (up to ~9,999,999 m = ~10,000 km), all with 4dp precision.

    calc_version is a free-form label such as "metro-distance-v1" or
    "cafe-density-v2". It must be set by the ingestion pipeline.
    """

    __tablename__ = "locality_metric"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    locality_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("locality.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    metric_type: Mapped[MetricType] = mapped_column(
        Enum(
            MetricType,
            name="metric_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )

    # Numeric value. NUMERIC (not float) to avoid rounding artefacts.
    value: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)

    # Optional unit for human understanding, e.g. "count/km2", "metres", "score"
    unit: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Which calculation version produced this row, e.g. "cafe-density-v1"
    calc_version: Mapped[str] = mapped_column(String(80), nullable=False)

    # Timestamp the calculation was run (not necessarily import time)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Optional unstructured metadata for explainability
    # e.g., {"nearest_station_slug": "indiranagar"}
    extra_data = mapped_column(
        "extra_data",
        JSONB,
        nullable=True,
    )

    # Which dataset snapshot was the input to this calculation
    snapshot_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("dataset_snapshot.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    confidence: Mapped[MetricConfidence] = mapped_column(
        Enum(
            MetricConfidence,
            name="metric_confidence",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )

    # If True, this is the version used by the recommendation engine
    is_current: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        # One calc_version per metric per locality per snapshot — prevents accidental duplicates
        UniqueConstraint(
            "locality_id",
            "metric_type",
            "calc_version",
            "snapshot_id",
            name="uq_locality_metric_calc_version_snap",
        ),
        CheckConstraint(
            "length(trim(calc_version)) > 0",
            name="ck_locality_metric_calc_version_nonempty",
        ),
        Index("ix_locality_metric_locality_id_metric_type", "locality_id", "metric_type"),
    )

    locality: Mapped[Locality] = relationship(
        "Locality",
        back_populates="metrics",
        lazy="raise",
    )

    snapshot: Mapped[DatasetSnapshot | None] = relationship(
        "DatasetSnapshot",
        lazy="raise",
        foreign_keys=[snapshot_id],
    )

    def __repr__(self) -> str:
        return (
            f"<LocalityMetric locality_id={self.locality_id} "
            f"type={self.metric_type} value={self.value} ver={self.calc_version!r}>"
        )
