from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WorkLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(..., ge=-90, le=90, description="Latitude of the work location")
    lng: float = Field(..., ge=-180, le=180, description="Longitude of the work location")


class RecommendationConstraints(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_work_distance_km: float | None = Field(
        None, ge=0.1, description="Maximum acceptable distance to work in kilometers"
    )


class RecommendationPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metro_access_weight: float = Field(
        1.0, ge=0.0, le=1.0, description="Importance of metro proximity"
    )
    short_commute_weight: float = Field(
        1.0, ge=0.0, le=1.0, description="Importance of a short commute"
    )


class RecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    work_location: WorkLocation
    constraints: RecommendationConstraints = Field(
        default_factory=lambda: RecommendationConstraints(max_work_distance_km=None)
    )
    preferences: RecommendationPreferences = Field(
        default_factory=lambda: RecommendationPreferences(
            metro_access_weight=1.0, short_commute_weight=1.0
        )
    )
    limit: int = Field(10, ge=1, le=50, description="Maximum number of localities to return")

    @model_validator(mode="after")
    def validate_weights_sum(self) -> "RecommendationRequest":
        total_weight = self.preferences.metro_access_weight + self.preferences.short_commute_weight
        if total_weight == 0:
            raise ValueError("The sum of preference weights must be greater than 0.")
        return self


class ComponentScores(BaseModel):
    metro: float | None = Field(..., description="Normalized metro access score [0, 1]")
    work_distance: float = Field(..., description="Normalized work distance score [0, 1]")


class RawMetrics(BaseModel):
    metro_distance_m: float | None = Field(
        None, description="Actual distance to nearest metro in meters"
    )
    work_distance_km: float = Field(..., description="Actual straight-line distance to work in km")


class RecommendationExplanations(BaseModel):
    pros: list[str] = Field(..., description="Human-readable positive highlights")
    warnings: list[str] = Field(
        ..., description="Human-readable warnings or missing data indicators"
    )


class RecommendationResult(BaseModel):
    locality_id: int
    slug: str
    name: str
    rank: int
    total_score: float = Field(..., description="Total BLR Score [0, 100]")
    component_scores: ComponentScores
    raw_metrics: RawMetrics
    metadata: dict[str, Any] = Field(
        ..., description="Extraneous metadata (e.g. nearest station details)"
    )
    explanations: RecommendationExplanations


class RecommendationProvenance(BaseModel):
    calc_versions_used: list[str] = Field(
        ..., description="Dataset or calc versions utilized for this score"
    )


class RecommendationResponse(BaseModel):
    recommendations: list[RecommendationResult]
    provenance: RecommendationProvenance
