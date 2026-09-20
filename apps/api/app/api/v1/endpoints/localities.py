from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.localities import get_localities, get_locality_by_slug
from app.db.session import get_db
from app.schemas.locality import LocalityDetailResponse, LocalityListItem

router = APIRouter()


@router.get("", response_model=list[LocalityListItem])
async def list_localities(
    session: AsyncSession = Depends(get_db),
) -> list[LocalityListItem]:
    """
    Get a deterministic list of canonical active localities.
    """
    localities = await get_localities(session)
    return list(localities)


@router.get("/{slug}", response_model=LocalityDetailResponse)
async def get_locality_detail(
    slug: str,
    session: AsyncSession = Depends(get_db),
) -> LocalityDetailResponse:
    """
    Get factual locality information by slug.
    """
    locality = await get_locality_by_slug(session, slug)
    if not locality:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Locality not found",
        )
    return locality
