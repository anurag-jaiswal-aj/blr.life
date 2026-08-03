from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.observations import HousingConfiguration


class WorkLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(..., ge=-90, le=90, description="Latitude of the work location")
    lng: float = Field(..., ge=-180, le=180, description="Longitude of the work location")


class RecommendationConstraints(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_work_distance_km: float | None = Field(
        None, ge=0.1, description="Maximum acceptable distance to work in kilometers"
    )
    max_budget_inr: int | None = Field(
        None, ge=1000, description="Maximum monthly rent budget in INR"
    )
    bhk_type: HousingConfiguration | None = Field(
        None, description="Required housing configuration"
    )

    @model_validator(mode="after")
    def validate_housing_constraints(self) -> "RecommendationConstraints":
        if (self.max_budget_inr is not None and self.bhk_type is None) or (
            self.max_budget_inr is None and self.bhk_type is not None
        ):
            raise ValueError("Both max_budget_inr and bhk_type must be provided together.")
        return self


class RecommendationPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metro_access_weight: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Importance of metro proximity"
    )
    short_commute_weight: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Importance of a short commute"
    )
    cafe_weight: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Importance of cafe proximity"
    )
    restaurant_weight: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Importance of restaurant proximity"
    )
    park_weight: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Importance of park/green space proximity"
    )
    healthcare_weight: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Importance of healthcare proximity"
    )
    nightlife_weight: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Importance of nightlife proximity"
    )


class RecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    work_location: WorkLocation
    constraints: RecommendationConstraints = Field(
        default_factory=lambda: RecommendationConstraints(
            max_work_distance_km=None,
            max_budget_inr=None,
            bhk_type=None,
        )
    )
    preferences: RecommendationPreferences = Field(
        default_factory=lambda: RecommendationPreferences(
            metro_access_weight=1.0, short_commute_weight=1.0
        )
    )
    limit: int = Field(10, ge=1, le=50, description="Maximum number of localities to return")

    @model_validator(mode="after")
    def validate_weights_sum(self) -> "RecommendationRequest":
        total_weight = (
            self.preferences.metro_access_weight
            + self.preferences.short_commute_weight
            + self.preferences.cafe_weight
            + self.preferences.restaurant_weight
            + self.preferences.park_weight
            + self.preferences.healthcare_weight
            + self.preferences.nightlife_weight
        )
        if total_weight == 0:
            raise ValueError("The sum of preference weights must be greater than 0.")
        return self


class ComponentScores(BaseModel):
    metro: float | None = Field(None, description="Normalized metro access score [0, 1]")
    work_distance: float = Field(..., description="Normalized work distance score [0, 1]")
    cafe: float | None = Field(None, description="Normalized cafe score [0, 1]")
    restaurant: float | None = Field(None, description="Normalized restaurant score [0, 1]")
    park: float | None = Field(None, description="Normalized park score [0, 1]")
    healthcare: float | None = Field(None, description="Normalized healthcare score [0, 1]")
    nightlife: float | None = Field(None, description="Normalized nightlife score [0, 1]")


class RawMetrics(BaseModel):
    metro_distance_m: float | None = Field(
        None, description="Actual distance to nearest metro in meters"
    )
    work_distance_km: float = Field(..., description="Actual straight-line distance to work in km")
    cafe_accessibility: float | None = Field(None, description="Count of cafes within 1500m")
    restaurant_accessibility: float | None = Field(
        None, description="Count of restaurants within 1500m"
    )
    park_accessibility: float | None = Field(None, description="Count of parks within 1500m")
    healthcare_accessibility: float | None = Field(
        None, description="Count of hospitals/clinics within 1500m"
    )
    nightlife_accessibility: float | None = Field(
        None, description="Count of nightlife POIs within 1500m"
    )


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
