import base64
import os
from dataclasses import dataclass
from typing import Any

import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import settings

# HTTP Bearer scheme
security_scheme = HTTPBearer(auto_error=True)

# JWKS Client with caching
_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.CLERK_JWKS_URL, cache_keys=True, max_cached_keys=16)
    return _jwks_client


@dataclass
class AuthenticatedUser:
    id: str  # Clerk user ID (e.g. user_2P9xYz...)
    email: str | None = None
    claims: dict[str, Any] | None = None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
) -> AuthenticatedUser:
    """
    Validates Clerk RS256 JWT from the Authorization header and returns the AuthenticatedUser.
    Enforces multi-tenancy by providing the authenticated user_id (sub).
    """
    token = credentials.credentials

    # Development & test bypass when live Clerk is not configured
    if settings.DEV_MOCK_AUTH and (
        token.startswith("mock_") or token == "clerk_mock_user_123" or token == "test_token"
    ):
        # Extract user_id from token if provided, e.g. mock_user_456
        user_id = token if token != "test_token" else "user_mock_dev_alex"
        return AuthenticatedUser(
            id=user_id, email=f"{user_id}@tethr.dev", claims={"sub": user_id, "mock": True}
        )

    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.CLERK_ISSUER,
            options={"verify_exp": True, "verify_iss": True},
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="JWT token does not contain a subject (sub) claim.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return AuthenticatedUser(id=user_id, email=payload.get("email"), claims=payload)

    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except (jwt.InvalidTokenError, Exception) as exc:
        # If in dev mode and network call to Clerk JWKS failed, provide fallback
        if settings.DEV_MOCK_AUTH:
            return AuthenticatedUser(
                id="user_mock_dev_fallback",
                email="alex.rivera@github.dev",
                claims={"sub": "user_mock_dev_fallback", "mock": True},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# --- AES-256-GCM Cipher Utilities for Token Encryption at Rest ---


def _get_aes_key() -> bytes:
    try:
        key_bytes = base64.b64decode(settings.TOKEN_ENCRYPTION_KEY)
        if len(key_bytes) != 32:
            # Fallback pad/hash to 32 bytes for dev safety
            return key_bytes.ljust(32, b"0")[:32]
        return key_bytes
    except Exception:
        return b"thisis32bytesecretkeyforaes25600"[:32]


def encrypt_token(plain_text: str) -> str:
    """
    Encrypts a token using AES-256-GCM with a 12-byte random IV.
    Returns Base64 encoded string containing nonce + ciphertext + tag.
    """
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plain_text.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_token(cipher_text_b64: str) -> str:
    """
    Decrypts an AES-256-GCM Base64 string and verifies tag.
    """
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    raw_data = base64.b64decode(cipher_text_b64.encode("utf-8"))
    nonce = raw_data[:12]
    ciphertext = raw_data[12:]
    decrypted = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted.decode("utf-8")
