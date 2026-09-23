import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    """
    Verifies that the /health endpoint returns 200 and expected status payload.
    """
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["project"] == "Tethr API"


@pytest.mark.asyncio
async def test_tasks_unauthenticated(client):
    """
    Verifies that requests without Authorization header are rejected with 401/403.
    """
    response = await client.get("/api/v1/tasks")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_task_crud_lifecycle(client, user_a_headers, user_b_headers):
    """
    Tests full task creation, retrieval, filtering, updating, contributions, and multi-tenant isolation.
    """
    # 1. User A creates a task
    create_payload = {
        "title": "Build FastAPI MCP Service",
        "description": "Expose JSON-RPC 2.0 tools for Cursor and Claude Desktop",
        "status": "todo",
        "priority": "high",
        "tags": ["FastAPI", "MCP", "Backend"],
        "initial_contribution": "Drafted initial specification",
    }
    create_resp = await client.post("/api/v1/tasks", json=create_payload, headers=user_a_headers)
    assert create_resp.status_code == 201
    task_a = create_resp.json()
    assert task_a["title"] == create_payload["title"]
    assert task_a["user_id"] == "mock_user_alice"
    assert len(task_a["contributions"]) == 1
    assert task_a["contributions"][0]["note"] == "Drafted initial specification"
    task_id = task_a["id"]

    # 2. User A can retrieve the created task
    get_resp = await client.get(f"/api/v1/tasks/{task_id}", headers=user_a_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == task_id

    # 3. User B CANNOT retrieve User A's task (strict multi-tenant isolation)
    user_b_resp = await client.get(f"/api/v1/tasks/{task_id}", headers=user_b_headers)
    assert user_b_resp.status_code == 404

    # 4. User B's list is empty, while User A's list contains the task
    list_b = await client.get("/api/v1/tasks", headers=user_b_headers)
    assert list_b.status_code == 200
    assert list_b.json()["total"] == 0

    list_a = await client.get("/api/v1/tasks", headers=user_a_headers)
    assert list_a.status_code == 200
    assert list_a.json()["total"] >= 1

    # 5. User A updates status and appends a contribution note
    update_payload = {
        "status": "in_progress",
        "contribution_note": "Added Beanie ODM models and indexes",
    }
    patch_resp = await client.patch(
        f"/api/v1/tasks/{task_id}", json=update_payload, headers=user_a_headers
    )
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    assert updated_data["status"] == "in_progress"
    assert len(updated_data["contributions"]) == 2
    assert updated_data["contributions"][1]["note"] == "Added Beanie ODM models and indexes"

    # 6. User A adds a dedicated contribution log
    contrib_resp = await client.post(
        f"/api/v1/tasks/{task_id}/contributions",
        json={"note": "Verified RS256 token verification"},
        headers=user_a_headers,
    )
    assert contrib_resp.status_code == 200
    assert len(contrib_resp.json()["contributions"]) == 3

    # 7. Test query filtering by status
    filter_resp = await client.get("/api/v1/tasks?status=in_progress", headers=user_a_headers)
    assert filter_resp.status_code == 200
    assert any(t["id"] == task_id for t in filter_resp.json()["items"])

    filter_empty = await client.get("/api/v1/tasks?status=done", headers=user_a_headers)
    assert filter_empty.status_code == 200
    assert not any(t["id"] == task_id for t in filter_empty.json()["items"])

    # 8. User A deletes the task
    del_resp = await client.delete(f"/api/v1/tasks/{task_id}", headers=user_a_headers)
    assert del_resp.status_code == 204

    # 9. Verify task no longer exists
    get_deleted = await client.get(f"/api/v1/tasks/{task_id}", headers=user_a_headers)
    assert get_deleted.status_code == 404
