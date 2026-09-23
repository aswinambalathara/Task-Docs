import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.core.db import init_db
from app.main import app


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """
    Initializes Beanie ODM with an in-memory async mock MongoDB client for tests.
    """
    mock_client = AsyncMongoMockClient()
    await init_db(client=mock_client)
    yield
    mock_client.close()


@pytest_asyncio.fixture
async def client():
    """
    Async HTTP client for testing FastAPI endpoints.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def user_a_headers():
    return {"Authorization": "Bearer mock_user_alice"}


@pytest.fixture
def user_b_headers():
    return {"Authorization": "Bearer mock_user_bob"}
