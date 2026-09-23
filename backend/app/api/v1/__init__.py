from fastapi import APIRouter

from app.api.v1.tasks import router as tasks_router

api_v1_router = APIRouter()
api_v1_router.include_router(tasks_router)

__all__ = ["api_v1_router"]
