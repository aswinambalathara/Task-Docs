import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core import security
from app.core.config import settings
from app.services.mcp_service import MCPService

ISSUER = "https://test-clerk.clerk.accounts.dev"
FRONTEND = "http://localhost:3000"

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _clerk_token(**claims) -> str:
    now = int(time.time())
    payload = {"iss": ISSUER, "sub": "user_clerk_real", "iat": now, "exp": now + 60, **claims}
    return jwt.encode(payload, _private_key, algorithm="RS256")


@pytest.fixture
def live_clerk(monkeypatch):
    """Real signature verification against a test key; no mock-auth fallback."""
    fake_jwks = SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=_private_key.public_key())
    )
    monkeypatch.setattr(security, "get_jwks_client", lambda: fake_jwks)
    monkeypatch.setattr(settings, "CLERK_ISSUER", ISSUER)
    monkeypatch.setattr(settings, "CLERK_AUTHORIZED_PARTIES", [FRONTEND])
    monkeypatch.setattr(settings, "DEV_MOCK_AUTH", False)


async def _get_tasks(client, token: str):
    return await client.get("/api/v1/tasks", headers={"Authorization": f"Bearer {token}"})


@pytest.mark.asyncio
async def test_token_from_our_frontend_is_accepted(client, live_clerk):
    assert (await _get_tasks(client, _clerk_token(azp=FRONTEND))).status_code == 200
    # Trailing slash differences don't matter
    assert (await _get_tasks(client, _clerk_token(azp=f"{FRONTEND}/"))).status_code == 200


@pytest.mark.asyncio
async def test_token_from_another_site_is_rejected(client, live_clerk):
    resp = await _get_tasks(client, _clerk_token(azp="https://some-other-app.example"))
    assert resp.status_code == 401
    assert "unauthorized party" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_token_without_azp_is_accepted(client, live_clerk):
    # Same rule as Clerk's SDKs: azp is only checked when present
    assert (await _get_tasks(client, _clerk_token())).status_code == 200


@pytest.mark.asyncio
async def test_wrong_issuer_and_expired_are_rejected(client, live_clerk):
    wrong_issuer = _clerk_token(azp=FRONTEND, iss="https://evil.clerk.accounts.dev")
    assert (await _get_tasks(client, wrong_issuer)).status_code == 401

    long_ago = int(time.time()) - 3600
    expired = _clerk_token(azp=FRONTEND, iat=long_ago, exp=long_ago + 60)
    resp = await _get_tasks(client, expired)
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_authorized_parties_default_to_cors_origins(client, live_clerk, monkeypatch):
    monkeypatch.setattr(settings, "CLERK_AUTHORIZED_PARTIES", [])
    monkeypatch.setattr(settings, "CORS_ORIGINS", ["http://127.0.0.1:3000"])
    assert (await _get_tasks(client, _clerk_token(azp="http://127.0.0.1:3000"))).status_code == 200
    assert (await _get_tasks(client, _clerk_token(azp=FRONTEND))).status_code == 401


@pytest.mark.asyncio
async def test_mcp_applies_the_same_azp_check(live_clerk):
    assert await MCPService.verify_mcp_token_string(_clerk_token(azp=FRONTEND)) == "user_clerk_real"
    assert await MCPService.verify_mcp_token_string(_clerk_token(azp="https://evil.example")) is None
