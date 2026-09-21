from fastapi import APIRouter

from app.api.v1.endpoints import geocode, localities, recommend

api_v1_router = APIRouter()

api_v1_router.include_router(recommend.router, prefix="/recommend", tags=["recommendations"])
api_v1_router.include_router(localities.router, prefix="/localities", tags=["localities"])
api_v1_router.include_router(geocode.router, prefix="/geocode", tags=["geocoding"])
