from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.security import AuthenticatedUser, get_current_user
from app.schemas.ai import PreviewQuotaResponse, SummarizeRequest, SummarizeResponse
from app.services.ai_quota import AIPreviewQuota
from app.services.ai_service import AIService
from app.services.google_docs import GoogleDocsService
from app.services.summary_periods import fingerprint
from app.services.task_service import TaskService

router = APIRouter(prefix="/ai", tags=["AI Summarization"])


@router.get("/preview-quota", response_model=PreviewQuotaResponse)
async def get_preview_quota(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> PreviewQuotaResponse:
    """Returns how many AI previews the user has left today."""
    return PreviewQuotaResponse(
        limit=settings.AI_PREVIEW_DAILY_LIMIT,
        remaining=await AIPreviewQuota.remaining(current_user.id),
        resets_at=AIPreviewQuota.resets_at(),
    )


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize_tasks(
    payload: SummarizeRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SummarizeResponse:
    """
    Synthesizes developer tasks and contributions into a 2-sentence executive summary
    and 3 achievement bullet points using Gemini 2.0 Flash (with deterministic fallback).
    Requests billed to the server's Gemini key are limited per user per day.
    """
    if payload.task_ids:
        tasks = await TaskService.get_tasks_for_sync(
            user_id=current_user.id, task_ids=payload.task_ids
        )
    else:
        # The same tasks a summary sync would write about, so the preview can be synced as is
        tasks = await GoogleDocsService.get_period_tasks(current_user.id, payload.mode)

    if not tasks:
        period = "month" if payload.mode == "monthly" else "week"
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No tasks logged this {period} to summarize.",
        )

    # Bring-your-own-key requests are billed to the caller, so they skip the quota
    metered = not payload.api_key
    remaining: int | None = None
    if metered:
        remaining = await AIPreviewQuota.claim(current_user.id)
        if remaining is None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Daily AI preview limit reached ({settings.AI_PREVIEW_DAILY_LIMIT} per day). "
                    "You can still sync to Google Docs; previews reset at midnight UTC."
                ),
                headers={"Retry-After": str(AIPreviewQuota.seconds_until_reset())},
            )

    try:
        summary_text, source = await AIService.generate_summary(
            tasks=tasks,
            api_key=payload.api_key,
            custom_context=payload.custom_context,
            mode=payload.mode,
        )
    except Exception:
        if metered:
            await AIPreviewQuota.refund(current_user.id)
        raise

    # The deterministic template costs nothing, so give the slot back
    if metered and source == "deterministic_fallback":
        remaining = await AIPreviewQuota.refund(current_user.id)

    return SummarizeResponse(
        executive_summary=summary_text,
        source=source,
        task_count=len(tasks),
        generated_at=datetime.now(UTC),
        fingerprint=fingerprint(tasks),
        remaining_previews=remaining,
    )
