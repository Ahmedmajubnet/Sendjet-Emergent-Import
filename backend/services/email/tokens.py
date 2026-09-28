"""Signed tokens for email verification and password reset.

Uses JWT (python-jose) with the same `SECRET_KEY` the rest of the auth system
uses. Each token type has its own `purpose` claim so a verify-email token
CANNOT be replayed against the password-reset endpoint (and vice versa).

Password-reset tokens also embed the user's current `hashed_password` prefix
as a `pw_ref` claim so that changing the password (or logging in a new
password) invalidates any outstanding reset link.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt


ALGORITHM = "HS256"

# TTLs
VERIFY_EMAIL_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(minutes=30)


def _secret() -> str:
    """Read the required signing secret from the private runtime environment."""
    value = os.environ.get("SECRET_KEY", "")
    if not value:
        raise RuntimeError("Set SECRET_KEY before issuing email tokens")
    return value


# ---------------------------------------------------------------------------
# Verify-email tokens
# ---------------------------------------------------------------------------
def make_verify_email_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "purpose": "verify_email",
        "iat": int(now.timestamp()),
        "exp": int((now + VERIFY_EMAIL_TTL).timestamp()),
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def decode_verify_email_token(token: str) -> Optional[dict]:
    """Return the payload if valid, else None. Callers must additionally check
    that `email` still matches the user record (defense in depth)."""
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("purpose") != "verify_email":
        return None
    return payload


# ---------------------------------------------------------------------------
# Password-reset tokens
# ---------------------------------------------------------------------------
def make_password_reset_token(user_id: str, pw_hash: str) -> str:
    """Reset tokens include a short pw_ref so old links auto-invalidate the
    moment the password is changed (whether via this flow or otherwise)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "purpose": "password_reset",
        "pw_ref": (pw_hash or "")[:12],   # a stable, non-secret slice
        "iat": int(now.timestamp()),
        "exp": int((now + PASSWORD_RESET_TTL).timestamp()),
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def decode_password_reset_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("purpose") != "password_reset":
        return None
    return payload
