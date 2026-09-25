from fastapi import APIRouter

from app.api.v1.ai import router as ai_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.tasks import router as tasks_router

api_v1_router = APIRouter()
api_v1_router.include_router(tasks_router)
api_v1_router.include_router(integrations_router)
api_v1_router.include_router(ai_router)

__all__ = ["api_v1_router"]
