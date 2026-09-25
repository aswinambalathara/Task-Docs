import pytest

from app.schemas.task import TaskCreate, TaskUpdate
from app.services.task_service import TaskService


@pytest.mark.asyncio
async def test_task_service_crud_lifecycle():
    user_id = "test_user_service_1"

    # 1. Create task with full impact schema
    create_payload = TaskCreate(
        title="Fixed CoreSignal API parameter issue",
        project="Chordian",
        area="Enrichment",
        type="Bug Fix",
        status="done",
        priority="high",
        requested_by="Oliver",
        outcome="Restored enrichment requests",
        evidence="PR #245",
        is_career_highlight=True,
        tags=["enrichment", "backend"],
        initial_contribution="Investigated API logs and corrected params",
        custom_fields={"sprint": 24},
    )
    task = await TaskService.create_task(user_id=user_id, payload=create_payload)
    assert task.id is not None
    assert task.user_id == user_id
    assert task.title == "Fixed CoreSignal API parameter issue"
    assert task.project == "Chordian"
    assert task.area == "Enrichment"
    assert task.type == "Bug Fix"
    assert task.outcome == "Restored enrichment requests"
    assert task.evidence == "PR #245"
    assert task.is_career_highlight is True
    assert task.custom_fields["sprint"] == 24
    assert len(task.contributions) == 1

    # 2. Get task by ID
    fetched = await TaskService.get_task_by_id(task_id=str(task.id), user_id=user_id)
    assert fetched is not None
    assert fetched.outcome == "Restored enrichment requests"

    # 3. Multi-tenant isolation (other user cannot get it)
    other_user_fetched = await TaskService.get_task_by_id(
        task_id=str(task.id), user_id="other_user"
    )
    assert other_user_fetched is None

    # 4. Add contribution
    updated = await TaskService.add_contribution(
        task_id=str(task.id), user_id=user_id, note="Deployed hotfix to production"
    )
    assert updated is not None
    assert len(updated.contributions) == 2

    # 5. Update task
    update_payload = TaskUpdate(status="done", outcome="Restored enrichment requests 100%")
    completed = await TaskService.update_task(
        task_id=str(task.id), user_id=user_id, payload=update_payload
    )
    assert completed is not None
    assert completed.outcome == "Restored enrichment requests 100%"

    # 6. List and filter tasks by project and career highlight
    tasks, total = await TaskService.list_tasks(
        user_id=user_id,
        project_filter="Chordian",
        is_career_highlight_filter=True,
    )
    assert total >= 1
    assert any(t.id == task.id for t in tasks)

    # 7. Get tasks for sync and mark as synced
    sync_tasks = await TaskService.get_tasks_for_sync(user_id=user_id, task_ids=[str(task.id)])
    assert len(sync_tasks) == 1
    assert sync_tasks[0].id == task.id

    await TaskService.mark_tasks_as_synced(task_ids=[str(task.id)], user_id=user_id)
    refetched = await TaskService.get_task_by_id(task_id=str(task.id), user_id=user_id)
    assert refetched.synced_to_docs is True

    # 8. Delete task
    deleted = await TaskService.delete_task(task_id=str(task.id), user_id=user_id)
    assert deleted is True
    assert await TaskService.get_task_by_id(task_id=str(task.id), user_id=user_id) is None
