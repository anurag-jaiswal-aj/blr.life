from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.locality import GeometryConfidence, GeometrySource


class IngestLocalityAlias(BaseModel):
    """Pydantic model for validating incoming locality aliases."""

    alias: str


class IngestLocality(BaseModel):
    """Pydantic model for validating incoming locality data.

    Expects geometries as standard WKT strings for simplicity during the
    initial dataset loading phase.
    """

    model_config = ConfigDict(extra="forbid")

    name: str
    slug: str
    parent_zone: str | None = None
    is_active: bool = True

    # Expected to be WKT strings (e.g. "MULTIPOLYGON(((...)))", "POINT(...)")
    geometry_wkt: str | None = None
    centroid_wkt: str

    geometry_source: GeometrySource | None = None
    geometry_confidence: GeometryConfidence | None = None
    external_source_id: str | None = None

    aliases: list[IngestLocalityAlias] = Field(default_factory=list)

    @field_validator("geometry_wkt")
    @classmethod
    def validate_geometry_wkt(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v_upper = v.strip().upper()
        if not (v_upper.startswith("POLYGON") or v_upper.startswith("MULTIPOLYGON")):
            raise ValueError("geometry_wkt must be a POLYGON or MULTIPOLYGON")
        return v

    @field_validator("centroid_wkt")
    @classmethod
    def validate_centroid_wkt(cls, v: str) -> str:
        v_upper = v.strip().upper()
        if not v_upper.startswith("POINT"):
            raise ValueError("centroid_wkt must be a POINT")
        return v


class IngestPayload(BaseModel):
    """Top-level payload for an ingestion import run."""

    data_source_key: str
    source_version: str | None = None
    notes: str | None = None
    localities: list[IngestLocality]
