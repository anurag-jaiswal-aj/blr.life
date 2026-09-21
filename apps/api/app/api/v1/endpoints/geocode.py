from fastapi import APIRouter, Query, Response, status

from app.core.logging import logger
from app.schemas.geocoding import GeocodingResponse
from app.services.geocoding import GeocodingException, geocode_query

router = APIRouter()


@router.get("", response_model=GeocodingResponse)
async def get_geocode(
    response: Response,
    q: str = Query(..., description="The query string to search for"),
) -> GeocodingResponse:
    """
    Geocode a query string. Proxies to Nominatim with a process-local rate limit.
    """
    try:
        results = await geocode_query(q)
        return GeocodingResponse(results=results)
    except GeocodingException as e:
        logger.error(f"Geocoding failed for '{q}': {e}")
        response.status_code = status.HTTP_502_BAD_GATEWAY
        return GeocodingResponse(
            results=[],
            error="Upstream geocoding service failed",
        )
    except Exception:
        logger.exception(f"Unexpected error during geocoding for '{q}'")
        response.status_code = status.HTTP_502_BAD_GATEWAY
        return GeocodingResponse(
            results=[],
            error="An unexpected error occurred during geocoding",
        )
