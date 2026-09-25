from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.ai import SummarizeRequest, SummarizeResponse
from app.services.ai_service import AIService
from app.services.task_service import TaskService

router = APIRouter(prefix="/ai", tags=["AI Summarization"])


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize_tasks(
    payload: SummarizeRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SummarizeResponse:
    """
    Synthesizes developer tasks and contributions into a 2-sentence executive summary
    and 3 achievement bullet points using Gemini 2.0 Flash (with deterministic fallback).
    """
    tasks = await TaskService.get_tasks_for_sync(user_id=current_user.id, task_ids=payload.task_ids)

    if not tasks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching tasks found to summarize.",
        )

    summary_text, source = await AIService.generate_summary(
        tasks=tasks,
        api_key=payload.api_key,
        custom_context=payload.custom_context,
        mode=payload.mode,
    )

    return SummarizeResponse(
        executive_summary=summary_text,
        source=source,
        task_count=len(tasks),
        generated_at=datetime.now(UTC),
    )
