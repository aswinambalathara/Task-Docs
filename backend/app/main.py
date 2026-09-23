from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_v1_router
from app.core.config import settings
from app.core.db import close_db, init_db
from app.core.logger import logger, setup_logging

# Initialize Loguru multi-file logging
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Application startup
    logger.info(f"Starting {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode...")
    try:
        await init_db()
    except Exception as e:
        logger.warning(
            f"Could not connect to MongoDB on startup ({e}). If running offline or in unit tests, this is expected."
        )

    yield

    # Application shutdown
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")
    await close_db()


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Tethr Backend API: Multi-tenant task tracking and Google Docs sync with MCP protocol support.",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Configure CORS for Next.js frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check endpoint
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "healthy",
            "project": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
        }

    # Mount API v1 routes
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    return app


app = create_application()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
