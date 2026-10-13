from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import AuthenticatedUser, get_current_user
from app.models.integration import Integration
from app.schemas.sync import (
    CreateDocRequest,
    CreateDocResponse,
    GoogleAuthUrlResponse,
    GoogleCallbackRequest,
    IntegrationStatusResponse,
    SummaryStatusResponse,
    SyncCadenceResponse,
    SyncCadenceUpdateRequest,
    SyncDocsRequest,
    SyncDocsResponse,
    TargetDocUpdateRequest,
)
from app.services import docs

router = APIRouter(prefix="/integrations/google", tags=["Integrations"])


def _to_cadence_response(integration: Integration) -> tuple[SyncCadenceResponse, int, int]:
    cadence = integration.cadence
    cadence_resp = SyncCadenceResponse(
        daily_table_cadence=cadence.daily_table_cadence,
        weekly_enabled=cadence.weekly_enabled,
        weekly_day=cadence.weekly_day,
        monthly_enabled=cadence.monthly_enabled,
        manual_syncs_this_week=cadence.manual_syncs_this_week,
        manual_syncs_this_month=cadence.manual_syncs_this_month,
        max_manual_syncs_per_cycle=cadence.max_manual_syncs_per_cycle,
        last_weekly_sync_at=cadence.last_weekly_sync_at,
        last_monthly_sync_at=cadence.last_monthly_sync_at,
        timezone=cadence.timezone,
        table_sync_pending=cadence.table_sync_pending,
        last_sync_error=cadence.last_sync_error,
        last_sync_error_at=cadence.last_sync_error_at,
        last_sync_error_retryable=cadence.last_sync_error_retryable,
    )
    rem_week = max(0, cadence.max_manual_syncs_per_cycle - cadence.manual_syncs_this_week)
    rem_month = max(0, cadence.max_manual_syncs_per_cycle - cadence.manual_syncs_this_month)
    return cadence_resp, rem_week, rem_month


@router.get("/auth-url", response_model=GoogleAuthUrlResponse)
async def get_google_auth_url(
    state: str | None = Query(None, description="Optional CSRF state"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> GoogleAuthUrlResponse:
    """
    Returns the Google OAuth 2.0 consent URL for connecting Google Docs.
    """
    auth_state = state or current_user.id
    url = docs.oauth.build_auth_url(state=auth_state)
    return GoogleAuthUrlResponse(auth_url=url)


@router.post("/callback", response_model=IntegrationStatusResponse)
async def handle_google_callback(
    payload: GoogleCallbackRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> IntegrationStatusResponse:
    """
    Exchanges OAuth code for access and refresh tokens, encrypted at rest.
    """
    try:
        integration = await docs.oauth.exchange_code_for_tokens(
            user_id=current_user.id,
            code=payload.code,
            code_verifier=payload.code_verifier,
        )
        if payload.timezone and payload.timezone != integration.cadence.timezone:
            integration.cadence.timezone = payload.timezone
            await integration.save()
        cadence_resp, rem_w, rem_m = _to_cadence_response(integration)
        return IntegrationStatusResponse(
            connected=True,
            target_doc_id=integration.target_doc_id or None,
            target_doc_title=integration.target_doc_title,
            updated_at=integration.updated_at,
            cadence=cadence_resp,
            remaining_manual_syncs_week=rem_w,
            remaining_manual_syncs_month=rem_m,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to authenticate with Google: {str(exc)}",
        ) from exc


@router.get("/status", response_model=IntegrationStatusResponse)
async def get_integration_status(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> IntegrationStatusResponse:
    """
    Checks if the user has an active Google Docs integration, doc configuration, and cadence budget.
    """
    integration = await Integration.find_one(
        {"user_id": current_user.id, "provider": "google_docs"}
    )
    if not integration or not integration.google_tokens:
        return IntegrationStatusResponse(connected=False)

    cadence_resp, rem_w, rem_m = _to_cadence_response(integration)
    return IntegrationStatusResponse(
        connected=True,
        target_doc_id=integration.target_doc_id or None,
        target_doc_title=integration.target_doc_title,
        updated_at=integration.updated_at,
        cadence=cadence_resp,
        remaining_manual_syncs_week=rem_w,
        remaining_manual_syncs_month=rem_m,
    )


@router.post("/target-doc", response_model=IntegrationStatusResponse)
async def update_target_doc(
    payload: TargetDocUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> IntegrationStatusResponse:
    """
    Sets the target Google Doc ID or URL to be used for automated sprint syncs.
    """
    integration = await docs.oauth.set_target_doc(
        user_id=current_user.id, target_doc_id=payload.target_doc_id
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Docs is not connected. Please connect your account first.",
        )

    cadence_resp, rem_w, rem_m = _to_cadence_response(integration)
    return IntegrationStatusResponse(
        connected=True,
        target_doc_id=integration.target_doc_id,
        target_doc_title=integration.target_doc_title,
        updated_at=integration.updated_at,
        cadence=cadence_resp,
        remaining_manual_syncs_week=rem_w,
        remaining_manual_syncs_month=rem_m,
    )


@router.post("/create-doc", response_model=CreateDocResponse)
async def create_google_doc(
    payload: CreateDocRequest | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> CreateDocResponse:
    """
    Creates a new Google Doc in the user's Google Drive, initializes it with standard
    Tethr headers, and saves it as the user's active target document for syncs.
    """
    try:
        title = payload.title if payload else None
        res = await docs.oauth.create_ledger_document(
            user_id=current_user.id, title=title
        )
        return CreateDocResponse(
            success=True,
            doc_id=res["doc_id"],
            title=res["title"],
            doc_url=res["doc_url"],
            message="Google Doc created and linked successfully",
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err)
        ) from val_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Google Doc: {str(exc)}",
        ) from exc


@router.patch("/cadence", response_model=IntegrationStatusResponse)
async def update_sync_cadence(
    payload: SyncCadenceUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> IntegrationStatusResponse:
    """
    Configures sync cadence settings (daily table realtime/end_of_day/weekly, weekly rollup day, monthly dossier).
    """
    integration = await Integration.find_one(
        {"user_id": current_user.id, "provider": "google_docs"}
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Docs is not connected. Please connect your account first.",
        )

    if payload.daily_table_cadence is not None:
        integration.cadence.daily_table_cadence = payload.daily_table_cadence
    if payload.weekly_enabled is not None:
        integration.cadence.weekly_enabled = payload.weekly_enabled
    if payload.weekly_day is not None:
        integration.cadence.weekly_day = payload.weekly_day
    if payload.monthly_enabled is not None:
        integration.cadence.monthly_enabled = payload.monthly_enabled
    if payload.timezone is not None:
        integration.cadence.timezone = payload.timezone

    integration.updated_at = datetime.now(UTC)
    await integration.save()

    cadence_resp, rem_w, rem_m = _to_cadence_response(integration)
    return IntegrationStatusResponse(
        connected=True,
        target_doc_id=integration.target_doc_id,
        target_doc_title=integration.target_doc_title,
        updated_at=integration.updated_at,
        cadence=cadence_resp,
        remaining_manual_syncs_week=rem_w,
        remaining_manual_syncs_month=rem_m,
    )


@router.get("/summary-status", response_model=SummaryStatusResponse)
async def get_summary_status(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SummaryStatusResponse:
    """
    Whether this week's summary and this month's dossier exist, and whether tasks were
    added or removed since they were written (stale ones are rewritten nightly).
    """
    result = await docs.summaries.get_summary_status(current_user.id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Docs is not connected. Please connect your account first.",
        )
    return SummaryStatusResponse(**result)


@router.post("/sync", response_model=SyncDocsResponse)
async def sync_docs(
    payload: SyncDocsRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SyncDocsResponse:
    """
    Syncs completed sprint updates and contribution notes to the configured Google Doc.
    Summary syncs are limited to 2 per weekly and monthly cycle; table-only syncs are unlimited.
    """
    try:
        result = await docs.sync.sync_sprint_to_doc(
            user_id=current_user.id,
            task_ids=payload.task_ids,
            cadence_type=payload.cadence_type,
            executive_summary=payload.executive_summary,
            monthly_dossier=payload.monthly_dossier,
            weekly_fingerprint=payload.weekly_fingerprint,
            monthly_fingerprint=payload.monthly_fingerprint,
            include_contributions=payload.include_contributions,
            # User requests always respect the manual sync limit
            force=False,
        )
        return SyncDocsResponse(**result)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err)
        ) from val_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google Docs sync failed: {str(exc)}",
        ) from exc


@router.delete("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_google(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Disconnects Google Docs integration and deletes encrypted tokens.
    """
    await docs.oauth.disconnect(user_id=current_user.id)
    return None
