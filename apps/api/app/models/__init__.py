"""blr.life domain models.

Import all models here so Alembic autodiscovery can find them
when env.py imports target_metadata from this package.
"""

from app.models.amenity import AmenityCategory, AmenityPOI
from app.models.base import Base
from app.models.locality import (
    GeometryConfidence,
    GeometrySource,
    Locality,
    LocalityAlias,
)
from app.models.metro import MetroStation
from app.models.observations import (
    HousingConfiguration,
    LocalityMetric,
    LocalityRentObservation,
    MetricConfidence,
    MetricType,
)
from app.models.provenance import DatasetSnapshot, DataSource

__all__ = [
    "Base",
    # enums
    "AmenityCategory",
    "GeometryConfidence",
    "GeometrySource",
    "HousingConfiguration",
    "MetricConfidence",
    "MetricType",
    # locality
    "Locality",
    "LocalityAlias",
    "MetroStation",
    "AmenityPOI",
    # observations
    "LocalityMetric",
    "LocalityRentObservation",
    # provenance
    "DataSource",
    "DatasetSnapshot",
]
