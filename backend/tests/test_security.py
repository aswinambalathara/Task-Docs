from app.core.security import decrypt_token, encrypt_token


def test_aes_encryption_roundtrip():
    """
    Verifies that OAuth tokens can be encrypted and decrypted accurately.
    """
    secret_refresh_token = "1//04xYz98_example_google_refresh_token_very_secret_abc123"

    encrypted = encrypt_token(secret_refresh_token)
    assert encrypted != secret_refresh_token
    assert isinstance(encrypted, str)

    decrypted = decrypt_token(encrypted)
    assert decrypted == secret_refresh_token


def test_aes_encryption_produces_unique_ciphertexts():
    """
    Verifies that unique nonces produce distinct ciphertexts for identical inputs.
    """
    plain = "same_plain_text"
    enc1 = encrypt_token(plain)
    enc2 = encrypt_token(plain)

    assert enc1 != enc2
    assert decrypt_token(enc1) == plain
    assert decrypt_token(enc2) == plain
