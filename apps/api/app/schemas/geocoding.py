from pydantic import BaseModel, Field


class GeocodingResult(BaseModel):
    place_id: int
    lat: float
    lng: float
    display_name: str
    name: str


class GeocodingResponse(BaseModel):
    results: list[GeocodingResult]
    error: str | None = Field(default=None)
