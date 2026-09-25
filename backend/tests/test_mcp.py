import pytest

from app.mcp.server import (
    add_task,
    current_mcp_user_var,
    get_tasks,
    sync_docs,
    update_task,
)
from app.models.task import Task


@pytest.mark.asyncio
async def test_mcp_tools_direct(setup_test_db):
    """
    Tests FastMCP tools: add_task, get_tasks, update_task, and sync_docs directly.
    """
    # 1. Set context for Alice
    ctx_token = current_mcp_user_var.set("mock_user_alice")
    try:
        # Add task
        add_result = await add_task(
            title="Deploy FastMCP Service",
            project="Tethr",
            area="MCP Server",
            type="Feature",
            status="todo",
            priority="high",
            outcome="Enabled agentic IDE task creation",
            evidence="PR #102",
            is_career_highlight=True,
        )
        assert "Task Created Successfully" in add_result
        assert "Deploy FastMCP Service" in add_result
        assert "CAREER HIGHLIGHT" in add_result

        # Verify database record
        created_task = await Task.find_one(
            {"user_id": "mock_user_alice", "title": "Deploy FastMCP Service"}
        )
        assert created_task is not None
        assert created_task.is_career_highlight is True
        task_id = str(created_task.id)

        # Get tasks
        list_result = await get_tasks(project="Tethr")
        assert "Deploy FastMCP Service" in list_result
        assert task_id in list_result

        # Update task
        update_result = await update_task(
            task_id=task_id,
            status="done",
            outcome="Successfully enabled SSE integration",
            contribution_note="Added FastMCP tools and tests",
        )
        assert "Updated Successfully" in update_result
        assert "Successfully enabled SSE integration" in update_result

        # Verify task is updated in database
        updated_db = await Task.get(created_task.id)
        assert updated_db.status == "done"
        assert len(updated_db.contributions) == 1
        assert updated_db.contributions[0].note == "Added FastMCP tools and tests"

        # Sync docs tool
        sync_result = await sync_docs()
        assert isinstance(sync_result, str)
        # Should gracefully notice that Google Docs is not connected
        assert (
            "Sync Notice" in sync_result
            or "Google Docs" in sync_result
            or "Successful" in sync_result
        )
    finally:
        current_mcp_user_var.reset(ctx_token)


@pytest.mark.asyncio
async def test_mcp_multi_tenant_isolation(setup_test_db):
    """
    Ensures that tasks created by Alice cannot be accessed or updated by Bob via FastMCP tools.
    """
    # 1. Alice creates a task
    alice_ctx = current_mcp_user_var.set("mock_user_alice")
    try:
        await add_task(
            title="Alice Private Core Refactor",
            project="Confidential",
            status="in_progress",
        )
        alice_task = await Task.find_one(
            {"user_id": "mock_user_alice", "title": "Alice Private Core Refactor"}
        )
        assert alice_task is not None
        alice_task_id = str(alice_task.id)
    finally:
        current_mcp_user_var.reset(alice_ctx)

    # 2. Bob calls get_tasks and tries to update Alice's task
    bob_ctx = current_mcp_user_var.set("mock_user_bob")
    try:
        bob_tasks = await get_tasks(project="Confidential")
        assert "Alice Private Core Refactor" not in bob_tasks

        # Bob attempts to update Alice's task
        hack_attempt = await update_task(
            task_id=alice_task_id,
            status="cancelled",
        )
        assert "not found" in hack_attempt.lower() or "error" in hack_attempt.lower()

        # Verify Alice's task in DB remains untouched
        check_task = await Task.get(alice_task.id)
        assert check_task.status == "in_progress"
    finally:
        current_mcp_user_var.reset(bob_ctx)


@pytest.mark.asyncio
async def test_mcp_auth_code_flow(client, user_a_headers):
    """
    Tests OAuth code generation, one-time redemption, token generation, and token validation.
    """
    # 1. Generate authorization code
    auth_resp = await client.post(
        "/api/v1/mcp/authorize",
        json={
            "client_id": "Antigravity IDE",
            "redirect_uri": "antigravity://auth/callback",
            "state": "xyz123",
        },
        headers=user_a_headers,
    )
    assert auth_resp.status_code == 200
    auth_data = auth_resp.json()
    assert auth_data["code"].startswith("td_auth_")
    assert auth_data["user_id"] == "mock_user_alice"
    assert auth_data["state"] == "xyz123"
    code = auth_data["code"]

    # 2. Exchange code for access token
    token_resp = await client.post(
        "/api/v1/mcp/token",
        json={"code": code},
    )
    assert token_resp.status_code == 200
    token_data = token_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "Bearer"
    assert token_data["user_id"] == "mock_user_alice"
    access_token = token_data["access_token"]

    # 3. Attempt to reuse redeemed code - should fail with 400
    reuse_resp = await client.post(
        "/api/v1/mcp/token",
        json={"code": code},
    )
    assert reuse_resp.status_code == 400

    # 4. Verify token via Bearer header
    me_resp = await client.get(
        "/api/v1/mcp/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["user_id"] == "mock_user_alice"

    # 5. Verify token via query parameter (?token=...)
    query_resp = await client.get(
        f"/api/v1/mcp/me?token={access_token}",
    )
    assert query_resp.status_code == 200
    assert query_resp.json()["user_id"] == "mock_user_alice"


@pytest.mark.asyncio
async def test_mcp_config_endpoint(client):
    """
    Tests that /api/v1/mcp/config returns correct configuration snippets for Antigravity & Cursor.
    """
    resp = await client.get("/api/v1/mcp/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "/sse" in data["sse_endpoint"]
    assert "antigravity" in data["recommended_clients"]
    assert "cursor" in data["recommended_clients"]
    assert "claude_code" in data["recommended_clients"]
