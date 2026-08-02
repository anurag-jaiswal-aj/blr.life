from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.recommendation import get_candidate_localities
from app.db.session import get_db
from app.schemas.recommendation import (
    RecommendationProvenance,
    RecommendationRequest,
    RecommendationResponse,
)
from app.services.recommendation import rank_candidates

router = APIRouter()


@router.post("", response_model=RecommendationResponse)
async def recommend_localities(
    request: RecommendationRequest,
    session: AsyncSession = Depends(get_db),
) -> RecommendationResponse:
    """
    Generate deterministic locality recommendations based on user preferences.
    Work location is transient and not persisted.
    """
    candidates = await get_candidate_localities(
        session=session,
        lat=request.work_location.lat,
        lng=request.work_location.lng,
    )

    results, calc_versions = rank_candidates(
        candidates=list(candidates),
        constraints=request.constraints,
        preferences=request.preferences,
        limit=request.limit,
    )

    return RecommendationResponse(
        recommendations=results,
        provenance=RecommendationProvenance(calc_versions_used=calc_versions),
    )
