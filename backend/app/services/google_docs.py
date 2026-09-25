from datetime import UTC, datetime
from typing import Any, Literal

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from loguru import logger

from app.core.config import settings
from app.core.security import decrypt_token, encrypt_token
from app.models.integration import GoogleTokens, Integration
from app.models.task import Task
from app.services.task_service import TaskService


class GoogleDocsService:
    """
    Manages Google OAuth 2.0 lifecycle, Google Docs table/summary generation,
    and cadence rate limiting (max 2 manual runs per cycle).
    """

    @staticmethod
    def _create_oauth_flow(state: str | None = None) -> Flow:
        client_config = {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            }
        }
        flow = Flow.from_client_config(
            client_config=client_config,
            scopes=settings.GOOGLE_SCOPES,
            state=state,
        )
        flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
        return flow

    @staticmethod
    def build_auth_url(state: str | None = None) -> str:
        flow = GoogleDocsService._create_oauth_flow(state=state)
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        return auth_url

    @staticmethod
    async def exchange_code_for_tokens(user_id: str, code: str) -> Integration:
        flow = GoogleDocsService._create_oauth_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials

        refresh_token = credentials.refresh_token or ""
        encrypted_refresh = encrypt_token(refresh_token) if refresh_token else ""

        expiry_ms = (
            int(credentials.expiry.replace(tzinfo=UTC).timestamp() * 1000)
            if credentials.expiry
            else int(datetime.now(UTC).timestamp() * 1000) + 3600000
        )

        google_tokens = GoogleTokens(
            access_token=credentials.token or "",
            refresh_token=encrypted_refresh,
            expiry_date=expiry_ms,
        )

        integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
        if integration:
            integration.google_tokens = google_tokens
            integration.updated_at = datetime.now(UTC)
            await integration.save()
        else:
            integration = Integration(
                user_id=user_id,
                provider="google_docs",
                target_doc_id="",
                target_doc_title=None,
                google_tokens=google_tokens,
                updated_at=datetime.now(UTC),
            )
            await integration.insert()

        logger.info(f"Google integration saved successfully for user {user_id}")
        return integration

    @staticmethod
    async def get_credentials(user_id: str) -> Credentials | None:
        integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
        if not integration or not integration.google_tokens:
            return None

        encrypted_refresh = integration.google_tokens.refresh_token
        plain_refresh = decrypt_token(encrypted_refresh) if encrypted_refresh else None

        credentials = Credentials(
            token=integration.google_tokens.access_token,
            refresh_token=plain_refresh,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=settings.GOOGLE_SCOPES,
        )

        if credentials.expired or not credentials.valid:
            try:
                credentials.refresh(Request())
                integration.google_tokens.access_token = credentials.token or ""
                if credentials.expiry:
                    integration.google_tokens.expiry_date = int(
                        credentials.expiry.replace(tzinfo=UTC).timestamp() * 1000
                    )
                integration.updated_at = datetime.now(UTC)
                await integration.save()
                logger.info(f"Refreshed Google OAuth token for user {user_id}")
            except Exception as exc:
                logger.error(f"Failed to refresh Google OAuth token for user {user_id}: {exc}")
                return None

        return credentials

    @staticmethod
    async def get_target_doc_info(user_id: str, doc_id: str) -> dict[str, Any] | None:
        credentials = await GoogleDocsService.get_credentials(user_id)
        if not credentials:
            return None

        try:
            service = build("docs", "v1", credentials=credentials, cache_discovery=False)
            doc = service.documents().get(documentId=doc_id).execute()
            return {"title": doc.get("title", "Untitled Document"), "id": doc.get("documentId")}
        except Exception as exc:
            logger.error(f"Error fetching Google Doc {doc_id} for user {user_id}: {exc}")
            return None

    @staticmethod
    async def set_target_doc(user_id: str, target_doc_id: str) -> Integration | None:
        integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
        if not integration:
            return None

        doc_info = await GoogleDocsService.get_target_doc_info(user_id, target_doc_id)
        title = doc_info["title"] if doc_info else None

        integration.target_doc_id = target_doc_id
        integration.target_doc_title = title
        integration.updated_at = datetime.now(UTC)
        await integration.save()
        return integration

    @staticmethod
    async def disconnect(user_id: str) -> bool:
        integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
        if not integration:
            return False
        await integration.delete()
        return True

    @staticmethod
    def build_daily_contribution_log_table(tasks: list[Task]) -> str:
        """
        Builds the markdown Daily Contribution Log table following the exact vision from documentation structure plan:
        | Date | Project | Area | Contribution | Type | Priority | Requested By | Status | Outcome | Evidence |
        """
        lines = [
            "### 📋 DAILY CONTRIBUTION LOG",
            "| Date | Project | Area | Contribution | Type | Priority | Requested By | Status | Outcome | Evidence |",
            "|---|---|---|---|---|---|---|---|---|---|",
        ]
        for t in tasks:
            date_str = t.date.strftime("%b %d")
            area_str = t.area or "—"
            req_str = t.requested_by or "—"
            outcome_str = t.outcome or "—"
            evidence_str = t.evidence or "—"
            status_str = t.status.capitalize()
            lines.append(
                f"| {date_str} | {t.project} | {area_str} | {t.title} | {t.type} | {t.priority.upper()} | {req_str} | {status_str} | {outcome_str} | {evidence_str} |"
            )
        return "\n".join(lines)

    @staticmethod
    def build_full_sync_document_text(
        tasks: list[Task],
        weekly_summary: str | None = None,
        monthly_dossier: str | None = None,
        cadence_type: str = "all",
    ) -> str:
        """
        Assembles structured sections for Google Docs insertion based on requested cadence.
        """
        now_str = datetime.now(UTC).strftime("%B %d, %Y - %H:%M UTC")
        blocks = [
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"🚀 TETHR CONTRIBUTION & IMPACT UPDATE — {now_str}",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
        ]

        # 1. Monthly Dossier (if requested)
        if cadence_type in ["monthly_dossier", "all"] and monthly_dossier:
            blocks.append(monthly_dossier)
            blocks.append("\n" + "─" * 60 + "\n")

        # 2. Weekly Summary (if requested)
        if cadence_type in ["weekly_summary", "all"] and weekly_summary:
            blocks.append(weekly_summary)
            blocks.append("\n" + "─" * 60 + "\n")

        # 3. Daily Contribution Log Table (if requested)
        if cadence_type in ["daily_table", "all"] and tasks:
            blocks.append(GoogleDocsService.build_daily_contribution_log_table(tasks))

        blocks.append("\n\n")
        return "\n".join(blocks)

    @staticmethod
    def check_and_update_rate_limit(
        integration: Integration,
        cadence_type: Literal["daily_table", "weekly_summary", "monthly_dossier", "all"] = "all",
        force: bool = False,
    ) -> tuple[int, int]:
        """
        Enforces maximum 2 manual syncs per weekly and monthly cycle for summary generation.
        Daily table syncs are not rate-limited.
        Automatically resets counters if the calendar week or month has rolled over.
        """
        now = datetime.now(UTC)
        cadence = integration.cadence

        # Check weekly cycle rollover (7 days)
        if (now - cadence.week_cycle_started_at).days >= 7:
            cadence.manual_syncs_this_week = 0
            cadence.week_cycle_started_at = now

        # Check monthly cycle rollover (calendar month)
        if (
            now.month != cadence.month_cycle_started_at.month
            or now.year != cadence.month_cycle_started_at.year
        ):
            cadence.manual_syncs_this_month = 0
            cadence.month_cycle_started_at = now

        if not force:
            if cadence_type in ["weekly_summary", "all"]:
                if cadence.manual_syncs_this_week >= cadence.max_manual_syncs_per_cycle:
                    raise ValueError(
                        f"Weekly manual sync limit reached ({cadence.max_manual_syncs_per_cycle} max). "
                        f"Next automated sync is scheduled for {cadence.weekly_day}."
                    )
                cadence.manual_syncs_this_week += 1

            if cadence_type in ["monthly_dossier", "all"]:
                if cadence.manual_syncs_this_month >= cadence.max_manual_syncs_per_cycle:
                    raise ValueError(
                        f"Monthly manual sync limit reached ({cadence.max_manual_syncs_per_cycle} max). "
                        "Next automated sync is scheduled for the last calendar day of this month."
                    )
                cadence.manual_syncs_this_month += 1

        remaining_week = max(0, cadence.max_manual_syncs_per_cycle - cadence.manual_syncs_this_week)
        remaining_month = max(
            0, cadence.max_manual_syncs_per_cycle - cadence.manual_syncs_this_month
        )
        return remaining_week, remaining_month

    @staticmethod
    async def sync_task_realtime(user_id: str, task: Task) -> bool:
        """
        Immediately syncs a completed task into the Google Doc Daily Contribution Log table
        if the user's cadence is configured for realtime sync.
        """
        try:
            integration = await Integration.find_one(
                {"user_id": user_id, "provider": "google_docs"}
            )
            if not integration or not integration.target_doc_id:
                return False
            if integration.cadence.daily_table_cadence != "realtime":
                return False

            credentials = await GoogleDocsService.get_credentials(user_id)
            if not credentials:
                return False

            table_text = GoogleDocsService.build_daily_contribution_log_table([task])
            entry_text = f"\n{table_text}\n"

            service = build("docs", "v1", credentials=credentials, cache_discovery=False)
            requests = [
                {
                    "insertText": {
                        "location": {"index": 1},
                        "text": entry_text,
                    }
                }
            ]
            service.documents().batchUpdate(
                documentId=integration.target_doc_id, body={"requests": requests}
            ).execute()

            task.synced_to_docs = True
            await task.save()
            logger.info(f"Realtime synced task {task.id} to Google Doc {integration.target_doc_id}")
            return True
        except Exception as exc:
            logger.warning(f"Realtime sync to Google Docs failed for task {task.id}: {exc}")
            return False

    @staticmethod
    async def sync_sprint_to_doc(
        user_id: str,
        task_ids: list[str] | None = None,
        cadence_type: Literal["daily_table", "weekly_summary", "monthly_dossier", "all"] = "all",
        executive_summary: str | None = None,
        include_contributions: bool = True,
        force: bool = False,
    ) -> dict[str, Any]:
        """
        Executes Google Docs batchUpdate to sync structured impact tables and summaries
        while respecting the cadence rate limits.
        """
        integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
        if not integration or not integration.target_doc_id:
            raise ValueError(
                "No target Google Doc configured. Please connect and select a doc in Settings."
            )

        credentials = await GoogleDocsService.get_credentials(user_id)
        if not credentials:
            raise ValueError(
                "Google authentication credentials are invalid or expired. Please re-authenticate."
            )

        # 1. Enforce rate limiting
        rem_week, rem_month = GoogleDocsService.check_and_update_rate_limit(
            integration, cadence_type=cadence_type, force=force
        )

        # 2. Fetch tasks
        tasks = await TaskService.get_tasks_for_sync(user_id=user_id, task_ids=task_ids)
        if not tasks:
            raise ValueError("No tasks found to sync.")

        # 3. Generate summaries if needed
        from app.services.ai_service import AIService

        weekly_summary = executive_summary
        monthly_dossier = None

        if cadence_type in ["weekly_summary", "all"] and not weekly_summary:
            weekly_summary, _ = await AIService.generate_summary(tasks=tasks, mode="weekly")

        if cadence_type in ["monthly_dossier", "all"]:
            monthly_dossier, _ = await AIService.generate_summary(tasks=tasks, mode="monthly")

        # 4. Build text block
        text_block = GoogleDocsService.build_full_sync_document_text(
            tasks=tasks,
            weekly_summary=weekly_summary,
            monthly_dossier=monthly_dossier,
            cadence_type=cadence_type,
        )

        # 5. Insert at beginning of document (index 1)
        service = build("docs", "v1", credentials=credentials, cache_discovery=False)
        requests = [
            {
                "insertText": {
                    "location": {"index": 1},
                    "text": text_block,
                }
            }
        ]

        service.documents().batchUpdate(
            documentId=integration.target_doc_id, body={"requests": requests}
        ).execute()

        # 6. Mark tasks as synced and record sync timestamp
        now = datetime.now(UTC)
        if cadence_type in ["weekly_summary", "all"]:
            integration.cadence.last_weekly_sync_at = now
        if cadence_type in ["monthly_dossier", "all"]:
            integration.cadence.last_monthly_sync_at = now
        integration.updated_at = now
        await integration.save()

        synced_ids = [str(t.id) for t in tasks]
        await TaskService.mark_tasks_as_synced(task_ids=synced_ids, user_id=user_id)

        doc_url = f"https://docs.google.com/document/d/{integration.target_doc_id}/edit"
        return {
            "success": True,
            "doc_id": integration.target_doc_id,
            "synced_tasks_count": len(tasks),
            "doc_url": doc_url,
            "synced_at": now,
            "cadence_type": cadence_type,
            "remaining_manual_syncs_week": rem_week,
            "remaining_manual_syncs_month": rem_month,
        }
