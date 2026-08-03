import json
from collections.abc import Sequence

from sqlalchemy import String, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.locality import Locality
from app.models.observations import (
    HousingConfiguration,
    LocalityMetric,
    LocalityRentObservation,
    MetricType,
)
from app.services.recommendation import CandidateLocality


async def get_candidate_localities(
    session: AsyncSession,
    lat: float,
    lng: float,
    bhk_type: HousingConfiguration | None = None,
) -> Sequence[CandidateLocality]:
    """
    Fetch all active localities along with their computed work distance
    and metro metrics in a single query.
    """
    # Use PostGIS ST_DistanceSphere for work_distance_km
    # Note: ST_DistanceSphere returns meters. We divide by 1000 for km.
    work_point = f"SRID=4326;POINT({lng} {lat})"

    stmt = select(
        Locality.id,
        Locality.slug,
        Locality.name,
        func.ST_Y(Locality.centroid).label("lat"),
        func.ST_X(Locality.centroid).label("lng"),
        (
            func.ST_DistanceSphere(Locality.centroid, func.ST_GeomFromEWKT(work_point)) / 1000.0
        ).label("work_distance_km"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.METRO_DISTANCE_M,
                    LocalityMetric.value,
                ),
                else_=None,
            )
        ).label("metro_distance_m"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.METRO_DISTANCE_M,
                    LocalityMetric.confidence,
                ),
                else_=None,
            )
        ).label("metro_confidence"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.METRO_DISTANCE_M,
                    LocalityMetric.extra_data.cast(String),
                ),
                else_=None,
            )
        ).label("metro_extra_data_str"),
        func.max(LocalityMetric.calc_version).label("calc_version"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.CAFE_ACCESSIBILITY,
                    LocalityMetric.value,
                ),
                else_=None,
            )
        ).label("cafe_count"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.CAFE_ACCESSIBILITY,
                    LocalityMetric.confidence,
                ),
                else_=None,
            )
        ).label("cafe_confidence"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.RESTAURANT_ACCESSIBILITY,
                    LocalityMetric.value,
                ),
                else_=None,
            )
        ).label("restaurant_count"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.RESTAURANT_ACCESSIBILITY,
                    LocalityMetric.confidence,
                ),
                else_=None,
            )
        ).label("restaurant_confidence"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.PARK_ACCESSIBILITY,
                    LocalityMetric.value,
                ),
                else_=None,
            )
        ).label("park_count"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.PARK_ACCESSIBILITY,
                    LocalityMetric.confidence,
                ),
                else_=None,
            )
        ).label("park_confidence"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.HEALTHCARE_ACCESSIBILITY,
                    LocalityMetric.value,
                ),
                else_=None,
            )
        ).label("healthcare_count"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.HEALTHCARE_ACCESSIBILITY,
                    LocalityMetric.confidence,
                ),
                else_=None,
            )
        ).label("healthcare_confidence"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.NIGHTLIFE_ACCESSIBILITY,
                    LocalityMetric.value,
                ),
                else_=None,
            )
        ).label("nightlife_count"),
        func.max(
            case(
                (
                    LocalityMetric.metric_type == MetricType.NIGHTLIFE_ACCESSIBILITY,
                    LocalityMetric.confidence,
                ),
                else_=None,
            )
        ).label("nightlife_confidence"),
    ).outerjoin(
        LocalityMetric,
        (LocalityMetric.locality_id == Locality.id) & (LocalityMetric.is_current == True),  # noqa: E712
    )

    if bhk_type:
        stmt = stmt.add_columns(
            func.max(LocalityRentObservation.rent_min_inr).label("rent_min_inr"),
            func.max(LocalityRentObservation.rent_max_inr).label("rent_max_inr"),
        ).outerjoin(
            LocalityRentObservation,
            (LocalityRentObservation.locality_id == Locality.id)
            & (LocalityRentObservation.housing_config == bhk_type)
            & (LocalityRentObservation.is_current == True),  # noqa: E712
        )

    stmt = stmt.where(Locality.is_active == True).group_by(Locality.id)  # noqa: E712

    result = await session.execute(stmt)
    rows = result.all()

    candidates = []
    for row in rows:
        extra_data = None
        if row.metro_extra_data_str:
            extra_data = json.loads(row.metro_extra_data_str)

        candidates.append(
            CandidateLocality(
                id=row.id,
                slug=row.slug,
                name=row.name,
                lat=float(row.lat),
                lng=float(row.lng),
                work_distance_km=float(row.work_distance_km),
                metro_distance_m=float(row.metro_distance_m)
                if row.metro_distance_m is not None
                else None,
                metro_confidence=row.metro_confidence if row.metro_confidence else None,
                metro_extra_data=extra_data,
                calc_version=row.calc_version,
                cafe_count=(float(row.cafe_count) if row.cafe_count is not None else None),
                cafe_confidence=row.cafe_confidence if row.cafe_confidence else None,
                restaurant_count=(
                    float(row.restaurant_count) if row.restaurant_count is not None else None
                ),
                restaurant_confidence=(
                    row.restaurant_confidence if row.restaurant_confidence else None
                ),
                park_count=(float(row.park_count) if row.park_count is not None else None),
                park_confidence=row.park_confidence if row.park_confidence else None,
                healthcare_count=(
                    float(row.healthcare_count) if row.healthcare_count is not None else None
                ),
                healthcare_confidence=(
                    row.healthcare_confidence if row.healthcare_confidence else None
                ),
                nightlife_count=(
                    float(row.nightlife_count) if row.nightlife_count is not None else None
                ),
                nightlife_confidence=(
                    row.nightlife_confidence if row.nightlife_confidence else None
                ),
                rent_min_inr=getattr(row, "rent_min_inr", None),
                rent_max_inr=getattr(row, "rent_max_inr", None),
            )
        )

    return candidates
