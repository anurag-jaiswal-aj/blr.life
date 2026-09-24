from typing import Any

from pydantic import BaseModel


class LocalityListItem(BaseModel):
    id: int
    name: str
    slug: str
    parent_zone: str | None = None


class Coordinates(BaseModel):
    lat: float
    lng: float


class MetroInfo(BaseModel):
    station_name: str
    station_slug: str | None = None
    line: str | None = None
    distance_m: float


class AmenityCounts(BaseModel):
    cafes: float | None = None
    restaurants: float | None = None
    parks: float | None = None
    healthcare: float | None = None
    nightlife: float | None = None


class RentInfo(BaseModel):
    min_inr: int | None = None
    max_inr: int | None = None
    confidence: str


class LocalityDetailResponse(BaseModel):
    id: int
    name: str
    slug: str
    parent_zone: str | None = None
    centroid: Coordinates
    geometry_geojson: dict[str, Any] | None = None
    metro: MetroInfo | None = None
    amenities: AmenityCounts
    rent: RentInfo | None = None
