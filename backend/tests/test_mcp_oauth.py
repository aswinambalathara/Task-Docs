import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.mcp import mcp
from app.models.mcp import MCPAuthCode
from app.services.mcp_service import _hash

BOB_HEADERS = {"Authorization": "Bearer mock_user_bob"}


def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    )
    return verifier, challenge


async def _authorize(client, headers, **extra) -> str:
    resp = await client.post(
        "/api/v1/mcp/authorize",
        json={"client_id": "mcp_ide_test", "redirect_uri": "cursor://cb", **extra},
        headers=headers,
    )
    assert resp.status_code == 200
    return resp.json()["code"]


@pytest.mark.asyncio
async def test_pkce_form_encoded_exchange(client, user_a_headers):
    verifier, challenge = _pkce_pair()
    code = await _authorize(client, user_a_headers, code_challenge=challenge)

    missing = await client.post("/api/v1/mcp/token", data={"code": code})
    assert missing.status_code == 400
    wrong = await client.post(
        "/api/v1/mcp/token", data={"code": code, "code_verifier": "not-the-verifier"}
    )
    assert wrong.status_code == 400
    other_client = await client.post(
        "/api/v1/mcp/token",
        data={"code": code, "code_verifier": verifier, "client_id": "someone_else"},
    )
    assert other_client.status_code == 400

    ok = await client.post(
        "/api/v1/mcp/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": verifier,
            "client_id": "mcp_ide_test",
            "redirect_uri": "cursor://cb",
        },
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["access_token"].startswith("tethr_at_")
    assert body["refresh_token"].startswith("tethr_rt_")
    assert body["user_id"] == "mock_user_alice"


@pytest.mark.asyncio
async def test_plain_pkce_method_rejected(client, user_a_headers):
    resp = await client.post(
        "/api/v1/mcp/authorize",
        json={"code_challenge": "abc", "code_challenge_method": "plain"},
        headers=user_a_headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_auth_code_is_not_a_bearer_token(client, user_a_headers):
    code = await _authorize(client, user_a_headers)
    resp = await client.get("/api/v1/mcp/me", headers={"Authorization": f"Bearer {code}"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_expired_code_rejected(client, user_a_headers):
    code = await _authorize(client, user_a_headers)
    # Direct update: the TTL index may purge the expired document before we read it back
    await MCPAuthCode.get_motor_collection().update_one(
        {"code_hash": _hash(code)},
        {"$set": {"expires_at": datetime.now(UTC) - timedelta(seconds=1)}},
    )

    resp = await client.post("/api/v1/mcp/token", json={"code": code})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_unknown_grant_type_rejected(client):
    resp = await client.post("/api/v1/mcp/token", data={"grant_type": "password"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_refresh_rotation_and_revocation(client, user_a_headers):
    code = await _authorize(client, user_a_headers)
    first = (await client.post("/api/v1/mcp/token", json={"code": code})).json()

    refreshed = await client.post(
        "/api/v1/mcp/token",
        data={"grant_type": "refresh_token", "refresh_token": first["refresh_token"]},
    )
    assert refreshed.status_code == 200
    second = refreshed.json()
    assert second["access_token"] != first["access_token"]

    # Old pair is retired: refresh token is single-use and the old access token stops working
    replay = await client.post(
        "/api/v1/mcp/token",
        data={"grant_type": "refresh_token", "refresh_token": first["refresh_token"]},
    )
    assert replay.status_code == 400
    old_me = await client.get(
        "/api/v1/mcp/me", headers={"Authorization": f"Bearer {first['access_token']}"}
    )
    assert old_me.status_code == 401

    new_headers = {"Authorization": f"Bearer {second['access_token']}"}
    assert (await client.get("/api/v1/mcp/me", headers=new_headers)).status_code == 200

    # Connections are visible and revocable by their owner only
    connections = (await client.get("/api/v1/mcp/connections", headers=user_a_headers)).json()
    assert connections
    alice_ids = {c["id"] for c in connections}
    bob_resp = await client.get("/api/v1/mcp/connections", headers=BOB_HEADERS)
    bob_ids = {c["id"] for c in bob_resp.json()}
    assert not alice_ids & bob_ids

    for conn_id in alice_ids:
        bob_revoke = await client.delete(f"/api/v1/mcp/connections/{conn_id}", headers=BOB_HEADERS)
        assert bob_revoke.status_code == 404
        revoke = await client.delete(f"/api/v1/mcp/connections/{conn_id}", headers=user_a_headers)
        assert revoke.status_code == 204

    assert (await client.get("/api/v1/mcp/me", headers=new_headers)).status_code == 401


@pytest.mark.asyncio
async def test_transport_requires_auth_and_serves_streamable_http():
    # MCP's DNS-rebinding protection only accepts known hosts such as localhost
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost") as client:
        await _assert_transport(client)


async def _assert_transport(client):
    init = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "pytest", "version": "1"},
        },
    }
    accept = {"Accept": "application/json, text/event-stream"}

    # No token: OAuth challenge pointing at the discovery metadata
    unauth = await client.post("/mcp", json=init, headers=accept)
    assert unauth.status_code == 401
    assert "resource_metadata" in unauth.headers["www-authenticate"]

    async with mcp.session_manager.run():
        for path in ("/mcp", "/sse"):
            resp = await client.post(
                path, json=init, headers={**accept, "Authorization": "Bearer mock_user_alice"}
            )
            assert resp.status_code == 200, path
            assert "protocolVersion" in resp.text
