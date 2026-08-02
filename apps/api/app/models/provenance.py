"""Provenance models: DataSource and DatasetSnapshot.

These represent WHERE data came from and WHEN it was imported.
Every locality, metric, or rent observation can be traced back to a
DatasetSnapshot, which in turn points to a DataSource.

Primary key strategy: integer (bigint via BigInteger) for these tables.
These are small reference tables queried by FK. Auto-increment integers
are simpler, more readable in logs, and have no distributed-ID concerns
for a monolith.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SourceStatus(enum.StrEnum):
    """Whether this data source is currently used for new imports."""

    ACTIVE = "active"
    DEPRECATED = "deprecated"


class SnapshotStatus(enum.StrEnum):
    """Lifecycle state of a dataset snapshot / import run."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class DataSource(Base):
    """A named, citable origin of data imported into blr.life.

    Examples:
      - "OSM Geofabrik Karnataka" (ODbL)
      - "blr.life manual curation"
      - "BMRCL community GeoJSON"
      - "Rent baseline 2025-Q1"

    Once created, DataSource rows are append-only and never deleted.
    Stable identifier/key is used so application code can reference known
    sources without hardcoded integer IDs.
    """

    __tablename__ = "data_source"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Machine-readable stable key, e.g. "osm_geofabrik_karnataka"
    key: Mapped[str] = mapped_column(String(80), nullable=False)

    # Human-facing display name
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Source URL or reference document
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # SPDX identifier or prose license name, e.g. "ODbL-1.0"
    license_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Required attribution text to include in UI/exports
    attribution_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Notes for operators, not end-users
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[SourceStatus] = mapped_column(
        Enum(
            SourceStatus,
            name="source_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=SourceStatus.ACTIVE,
        server_default=SourceStatus.ACTIVE.value,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("key", name="uq_data_source_key"),
        CheckConstraint("length(trim(key)) > 0", name="ck_data_source_key_nonempty"),
        CheckConstraint(
            "length(trim(display_name)) > 0", name="ck_data_source_display_name_nonempty"
        ),
    )

    # back-populated from DatasetSnapshot
    snapshots: Mapped[list["DatasetSnapshot"]] = relationship(
        "DatasetSnapshot",
        back_populates="data_source",
        lazy="raise",  # prevent accidental N+1
    )

    def __repr__(self) -> str:
        return f"<DataSource key={self.key!r} status={self.status}>"


class DatasetSnapshot(Base):
    """A concrete import event: one run of a data acquisition pipeline.

    Answers: "Which dataset/import produced this locality or metric?"

    A snapshot records:
      - which source it came from
      - the source's own version or date if known
      - when we retrieved/imported it
      - an optional content checksum for reproducibility
      - its lifecycle status

    This is intentionally minimal. We are not building an ETL workflow engine.
    One snapshot per import run is sufficient for V1 provenance tracing.
    """

    __tablename__ = "dataset_snapshot"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    data_source_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("data_source.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Version or date string from upstream, e.g. "2025-08-01" for Geofabrik daily
    source_version: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # When we ran the import
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Optional sha256 or md5 of the raw downloaded file
    content_checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)

    status: Mapped[SnapshotStatus] = mapped_column(
        Enum(
            SnapshotStatus,
            name="snapshot_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=SnapshotStatus.PENDING,
        server_default=SnapshotStatus.PENDING.value,
    )

    # Human notes about this import run, e.g. "karnataka-latest 2025-08-01"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # If set and True, this is the snapshot used for the current active locality data
    is_current: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    data_source: Mapped["DataSource"] = relationship(
        "DataSource",
        back_populates="snapshots",
        lazy="raise",
    )

    def __repr__(self) -> str:
        return (
            f"<DatasetSnapshot id={self.id} source_id={self.data_source_id} status={self.status}>"
        )
