from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import AuthenticatedUser, get_current_user
from app.models.integration import Integration
from app.schemas.sync import (
    GoogleAuthUrlResponse,
    GoogleCallbackRequest,
    IntegrationStatusResponse,
    SyncCadenceResponse,
    SyncCadenceUpdateRequest,
    SyncDocsRequest,
    SyncDocsResponse,
    TargetDocUpdateRequest,
)
from app.services.google_docs import GoogleDocsService

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
    url = GoogleDocsService.build_auth_url(state=auth_state)
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
        integration = await GoogleDocsService.exchange_code_for_tokens(
            user_id=current_user.id, code=payload.code
        )
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
    integration = await GoogleDocsService.set_target_doc(
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


@router.post("/sync", response_model=SyncDocsResponse)
async def sync_docs(
    payload: SyncDocsRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> SyncDocsResponse:
    """
    Syncs completed sprint updates and contribution notes to the configured Google Doc.
    Enforces maximum 2 manual syncs per cycle unless forced.
    """
    try:
        result = await GoogleDocsService.sync_sprint_to_doc(
            user_id=current_user.id,
            task_ids=payload.task_ids,
            cadence_type=payload.cadence_type,
            executive_summary=payload.executive_summary,
            include_contributions=payload.include_contributions,
            force=payload.force,
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
    await GoogleDocsService.disconnect(user_id=current_user.id)
    return None
