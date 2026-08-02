from fastapi import APIRouter

from app.api.v1.endpoints import recommend

api_v1_router = APIRouter()

api_v1_router.include_router(recommend.router, prefix="/recommend", tags=["recommendations"])
