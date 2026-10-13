"""
Google sign-in for the Docs integration: OAuth flow, stored tokens, and the target doc.
"""

import asyncio
from datetime import UTC, datetime
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from loguru import logger

from app.core.config import settings
from app.core.security import decrypt_token, encrypt_token
from app.models.integration import GoogleTokens, Integration


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
    flow.autogenerate_code_verifier = False
    return flow


def build_auth_url(state: str | None = None) -> str:
    flow = _create_oauth_flow(state=state)
    flow.autogenerate_code_verifier = False
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url


async def exchange_code_for_tokens(
    user_id: str, code: str, code_verifier: str | None = None
) -> Integration:
    flow = _create_oauth_flow()
    flow.autogenerate_code_verifier = False
    if code_verifier:
        flow.code_verifier = code_verifier
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
            await asyncio.to_thread(credentials.refresh, Request())
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


async def get_target_doc_info(user_id: str, doc_id: str) -> dict[str, Any] | None:
    credentials = await get_credentials(user_id)
    if not credentials:
        return None

    try:
        service = build("docs", "v1", credentials=credentials, cache_discovery=False)
        doc = service.documents().get(documentId=doc_id).execute()
        return {"title": doc.get("title", "Untitled Document"), "id": doc.get("documentId")}
    except Exception as exc:
        logger.error(f"Error fetching Google Doc {doc_id} for user {user_id}: {exc}")
        return None


async def set_target_doc(user_id: str, target_doc_id: str) -> Integration | None:
    integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
    if not integration:
        return None

    doc_info = await get_target_doc_info(user_id, target_doc_id)
    title = doc_info["title"] if doc_info else None

    integration.target_doc_id = target_doc_id
    integration.target_doc_title = title
    integration.updated_at = datetime.now(UTC)
    await integration.save()
    return integration


async def create_ledger_document(
    user_id: str, title: str | None = None
) -> dict[str, Any]:
    """
    Creates a new Google Doc in the user's Google Drive, initializes it with standard
    Tethr headers, and saves it as the user's active target_doc_id.
    """
    integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
    if not integration or not integration.google_tokens:
        raise ValueError("Google Docs is not connected. Please connect your Google account first.")

    credentials = await get_credentials(user_id)
    if not credentials:
        raise ValueError("Google authentication credentials expired or invalid. Please re-authenticate.")

    doc_title = title.strip() if title and title.strip() else "Tethr — Developer Contribution Ledger"
    try:
        service = build("docs", "v1", credentials=credentials, cache_discovery=False)
        doc = service.documents().create(body={"title": doc_title}).execute()
        doc_id = doc.get("documentId")
        if not doc_id:
            raise ValueError("Did not receive a document ID from Google Docs API.")

        now_str = datetime.now(UTC).strftime("%B %d, %Y")
        intro_text = (
            f"{doc_title}\n"
            f"Generated by Tethr • Initialized on {now_str}\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Evidence-based engineering log connecting Daily Contributions, Outcomes, and Verifiable Proof.\n\n"
        )

        service.documents().batchUpdate(
            documentId=doc_id,
            body={
                "requests": [
                    {
                        "insertText": {
                            "location": {"index": 1},
                            "text": intro_text,
                        }
                    }
                ]
            },
        ).execute()

        integration.target_doc_id = doc_id
        integration.target_doc_title = doc_title
        integration.updated_at = datetime.now(UTC)
        await integration.save()

        doc_url = f"https://docs.google.com/document/d/{doc_id}/edit"
        logger.info(f"Created new Google Doc {doc_id} ('{doc_title}') for user {user_id}")
        return {
            "doc_id": doc_id,
            "title": doc_title,
            "doc_url": doc_url,
        }
    except Exception as exc:
        logger.error(f"Failed to create Google Doc for user {user_id}: {exc}")
        raise


async def disconnect(user_id: str) -> bool:
    integration = await Integration.find_one({"user_id": user_id, "provider": "google_docs"})
    if not integration:
        return False
    await integration.delete()
    return True
