from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.logger import logger
from app.models.integration import Integration
from app.models.task import Task

motor_client: AsyncIOMotorClient | None = None


async def init_db(client: AsyncIOMotorClient | None = None) -> AsyncIOMotorClient:
    """
    Initializes the MongoDB Async Motor Client and Beanie ODM.
    Can accept a custom client (e.g. for testing with mongomock_motor).
    """
    global motor_client

    if client is not None:
        motor_client = client
    else:
        try:
            motor_client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=2000)
        except Exception as e:
            logger.error(f"Failed to create Motor client: {e}")
            raise e

    db = motor_client[settings.DATABASE_NAME]

    await init_beanie(database=db, document_models=[Task, Integration])
    logger.info(f"Connected to MongoDB ({settings.DATABASE_NAME}) & initialized Beanie ODM.")
    return motor_client


async def close_db():
    """
    Closes the Motor MongoDB client connection pool.
    """
    global motor_client
    if motor_client is not None:
        motor_client.close()
        logger.info("Closed MongoDB client connection.")
