from pydantic import BaseModel, Field


class IngestMetroStation(BaseModel):
    name: str = Field(..., min_length=1)
    slug: str = Field(..., pattern=r"^[a-z0-9-]+$")
    osm_id: str = Field(description="Original OSM ID (e.g. node/12345)")
    latitude: float = Field(..., ge=12.5, le=13.5)
    longitude: float = Field(..., ge=77.0, le=78.0)


class IngestMetroPayload(BaseModel):
    source_key: str = Field(...)
    source_version: str = Field(...)
    data_retrieved_at: str = Field(...)
    attribution: str | None = None
    stations: list[IngestMetroStation] = Field(..., min_length=1)
