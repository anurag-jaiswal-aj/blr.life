"""blr.life domain models.

Import all models here so Alembic autodiscovery can find them
when env.py imports target_metadata from this package.
"""

from app.models.base import Base
from app.models.locality import (
    GeometryConfidence,
    GeometrySource,
    Locality,
    LocalityAlias,
)
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
    "GeometryConfidence",
    "GeometrySource",
    "HousingConfiguration",
    "MetricConfidence",
    "MetricType",
    # locality
    "Locality",
    "LocalityAlias",
    # observations
    "LocalityMetric",
    "LocalityRentObservation",
    # provenance
    "DataSource",
    "DatasetSnapshot",
]
