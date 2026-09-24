import json
from collections.abc import Sequence

from sqlalchemy import String, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.locality import Locality
from app.models.observations import LocalityMetric, LocalityRentObservation, MetricType
from app.schemas.locality import (
    AmenityCounts,
    Coordinates,
    LocalityDetailResponse,
    LocalityListItem,
    MetroInfo,
    RentInfo,
)


async def get_localities(session: AsyncSession) -> Sequence[LocalityListItem]:
    stmt = (
        select(Locality.id, Locality.name, Locality.slug, Locality.parent_zone)
        .where(Locality.is_active)
        .order_by(Locality.name)
    )
    result = await session.execute(stmt)
    rows = result.all()

    return [
        LocalityListItem(id=row.id, name=row.name, slug=row.slug, parent_zone=row.parent_zone)
        for row in rows
    ]


async def get_locality_by_slug(session: AsyncSession, slug: str) -> LocalityDetailResponse | None:
    # 1. Retrieve locality identity
    stmt_loc = select(
        Locality.id,
        Locality.name,
        Locality.slug,
        Locality.parent_zone,
        func.ST_Y(Locality.centroid).label("lat"),
        func.ST_X(Locality.centroid).label("lng"),
        func.ST_AsGeoJSON(Locality.geometry).label("geometry_geojson"),
    ).where((Locality.slug == slug) & Locality.is_active)
    result_loc = await session.execute(stmt_loc)
    loc_row = result_loc.first()

    if not loc_row:
        return None

    locality_id = loc_row.id

    # 2. Retrieve locality metrics
    stmt_metrics = select(
        LocalityMetric.metric_type,
        LocalityMetric.value,
        LocalityMetric.extra_data.cast(String).label("extra_data_str"),
    ).where((LocalityMetric.locality_id == locality_id) & LocalityMetric.is_current)
    result_metrics = await session.execute(stmt_metrics)
    metric_rows = result_metrics.all()

    # 3. Retrieve rent observations
    stmt_rents = select(
        LocalityRentObservation.rent_min_inr,
        LocalityRentObservation.rent_max_inr,
        LocalityRentObservation.confidence.cast(String).label("confidence"),
    ).where(
        (LocalityRentObservation.locality_id == locality_id) & LocalityRentObservation.is_current
    )
    result_rents = await session.execute(stmt_rents)
    rent_rows = result_rents.all()

    # Process metrics
    metro = None
    amenities_data: dict[MetricType, float | None] = {
        MetricType.CAFE_ACCESSIBILITY: None,
        MetricType.RESTAURANT_ACCESSIBILITY: None,
        MetricType.PARK_ACCESSIBILITY: None,
        MetricType.HEALTHCARE_ACCESSIBILITY: None,
        MetricType.NIGHTLIFE_ACCESSIBILITY: None,
    }

    for m_row in metric_rows:
        m_type = m_row.metric_type
        if m_type == MetricType.METRO_DISTANCE_M:
            station_name = "Unknown"
            station_slug = None
            line = None
            if m_row.extra_data_str:
                try:
                    extra_data = json.loads(m_row.extra_data_str)
                    station_name = extra_data.get("nearest_station_name", "Unknown")
                    station_slug = extra_data.get("nearest_station_slug")
                    line = extra_data.get("nearest_station_line")
                except json.JSONDecodeError:
                    pass
            metro = MetroInfo(
                station_name=station_name,
                station_slug=station_slug,
                line=line,
                distance_m=float(m_row.value),
            )
        elif m_type in amenities_data:
            amenities_data[m_type] = float(m_row.value) if m_row.value is not None else None

    amenities = AmenityCounts(
        cafes=amenities_data[MetricType.CAFE_ACCESSIBILITY],
        restaurants=amenities_data[MetricType.RESTAURANT_ACCESSIBILITY],
        parks=amenities_data[MetricType.PARK_ACCESSIBILITY],
        healthcare=amenities_data[MetricType.HEALTHCARE_ACCESSIBILITY],
        nightlife=amenities_data[MetricType.NIGHTLIFE_ACCESSIBILITY],
    )

    # Process rent
    rent = None
    # If there is exactly ONE current configuration, return it.
    # If there are MULTIPLE current configurations, return None because there is no
    # canonical housing configuration defined, and blending them creates a false range.
    if len(rent_rows) == 1:
        r_row = rent_rows[0]
        if r_row.confidence is not None:
            rent = RentInfo(
                min_inr=r_row.rent_min_inr,
                max_inr=r_row.rent_max_inr,
                confidence=r_row.confidence,
            )

    return LocalityDetailResponse(
        id=loc_row.id,
        name=loc_row.name,
        slug=loc_row.slug,
        parent_zone=loc_row.parent_zone,
        centroid=Coordinates(lat=float(loc_row.lat), lng=float(loc_row.lng)),
        geometry_geojson=json.loads(loc_row.geometry_geojson) if loc_row.geometry_geojson else None,
        metro=metro,
        amenities=amenities,
        rent=rent,
    )
