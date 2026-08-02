from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.locality import Locality
from app.models.observations import LocalityMetric, MetricType
from app.services.recommendation import CandidateLocality


async def get_candidate_localities(
    session: AsyncSession, lat: float, lng: float
) -> Sequence[CandidateLocality]:
    """
    Fetch all active localities along with their computed work distance
    and metro metrics in a single query.
    """
    # Use PostGIS ST_DistanceSphere for work_distance_km
    # Note: ST_DistanceSphere returns meters. We divide by 1000 for km.
    work_point = f"SRID=4326;POINT({lng} {lat})"

    stmt = (
        select(
            Locality.id,
            Locality.slug,
            Locality.name,
            (
                func.ST_DistanceSphere(Locality.centroid, func.ST_GeomFromEWKT(work_point)) / 1000.0
            ).label("work_distance_km"),
            LocalityMetric.value.label("metro_distance_m"),
            LocalityMetric.extra_data.label("metro_extra_data"),
            LocalityMetric.calc_version,
            LocalityMetric.confidence.label("metro_confidence"),
        )
        .outerjoin(
            LocalityMetric,
            (LocalityMetric.locality_id == Locality.id)
            & (LocalityMetric.metric_type == MetricType.METRO_DISTANCE_M)
            & (LocalityMetric.is_current == True),  # noqa: E712
        )
        .where(Locality.is_active == True)  # noqa: E712
    )

    result = await session.execute(stmt)
    rows = result.all()

    candidates = []
    for row in rows:
        candidates.append(
            CandidateLocality(
                id=row.id,
                slug=row.slug,
                name=row.name,
                work_distance_km=float(row.work_distance_km),
                metro_distance_m=float(row.metro_distance_m)
                if row.metro_distance_m is not None
                else None,
                metro_confidence=row.metro_confidence if row.metro_confidence else None,
                metro_extra_data=row.metro_extra_data,
                calc_version=row.calc_version,
            )
        )

    return candidates
