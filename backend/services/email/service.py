"""High-level `EmailService` — this is what route handlers actually call.

    from services.email import get_email_service, EmailService
    
    @router.post("/auth/register")
    async def register(payload: UserCreate,
                       mailer: EmailService = Depends(get_email_service)):
        user = await create_user(payload)
        await mailer.send_welcome(user)
        await mailer.send_verification(user, verify_url=...)
        return user

Design notes
------------
- Route handlers pass in the domain object (a `User` Pydantic instance or a
  plain dict with `email` + `full_name`). This service handles subject/body/
  template rendering and delegates delivery to whichever `EmailProvider`
  it was constructed with.
- Errors are logged, NEVER re-raised into the auth flow. A failed welcome
  email must never break account creation. If the send fails, we log
  loudly (Sentry-ready) and return so the caller keeps running.
"""

from __future__ import annotations

import os
import hashlib
from html import escape
from typing import Any, Optional
from urllib.parse import quote

from fastapi import Request

from .base import EmailMessage, EmailProvider
from .null_provider import NullProvider
from .resend_provider import ResendProvider
from . import templates as tpl
from ..ai.logging_setup import get_logger


_log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------
def _public_site_url() -> str:
    """Base public URL used to construct action links inside emails."""
    return os.environ.get("PUBLIC_SITE_URL", "http://localhost:3000").strip().rstrip("/")


def _sender() -> str:
    """RFC-5322 formatted 'From' address."""
    return os.environ.get("EMAIL_FROM", 'SendJet <info@sendjet.de>')


def _reply_to() -> str:
    return os.environ.get("EMAIL_REPLY_TO", "info@sendjet.de")


def _first_name(full_name: str) -> str:
    return (full_name or "there").split()[0]


def _extract(user: Any) -> tuple[str, str, str]:
    """Return (id, email, full_name) from a User model or dict."""
    if hasattr(user, "id"):
        return str(user.id), str(user.email), str(getattr(user, "full_name", ""))
    return str(user.get("id", "")), str(user.get("email", "")), str(user.get("full_name", ""))


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class EmailService:
    """High-level email API. One instance is shared per process (see FastAPI wiring below)."""

    def __init__(self, provider: EmailProvider) -> None:
        self.provider = provider

    # -- Factories --------------------------------------------------------
    @classmethod
    def build_default(cls) -> "EmailService":
        """Pick a provider based on environment variables.

        - `RESEND_API_KEY` set → ResendProvider (production path)
        - Otherwise            → NullProvider (dev/preview without creds)
        """
        api_key = os.environ.get("RESEND_API_KEY", "").strip()
        if api_key:
            _log.info("email_service_ready", extra={"provider": "resend"})
            return cls(ResendProvider(api_key))
        _log.warning(
            "email_service_using_null_provider — set RESEND_API_KEY to enable delivery"
        )
        return cls(NullProvider())

    # -- Low-level ---------------------------------------------------------
    async def _send(self, msg: EmailMessage) -> bool:
        """Return True only when a real provider accepts the message."""
        if isinstance(self.provider, NullProvider):
            _log.warning("email_delivery_disabled")
            return False
        try:
            return bool(await self.provider.send(msg))
        except Exception:  # Provider errors may contain the secret email body.
            _log.error("email_send_failed", extra={"provider": self.provider.name})
            return False

    # -- High-level use cases ---------------------------------------------
    async def send_welcome(self, user: Any) -> None:
        user_id, email, full_name = _extract(user)
        base = _public_site_url()
        subject, html, text = tpl.welcome_email(
            first_name=_first_name(full_name),
            post_trip_url=f"{base}/create-trip",
            post_parcel_url=f"{base}/create-shipment",
            browse_url=f"{base}/marketplace",
        )
        await self._send(EmailMessage(
            to=[email],
            subject=subject,
            html=html,
            text=text,
            from_addr=_sender(),
            reply_to=_reply_to(),
            idempotency_key=f"welcome:{user_id}",
            tags={"category": "welcome"},
        ))

    async def send_verification(self, user: Any, *, token: str,
                                ttl_hours: int = 24) -> None:
        _, email, full_name = _extract(user)
        base = _public_site_url()
        verify_url = f"{base}/verify-email/{quote(token, safe='')}"
        subject, html, text = tpl.verify_email(
            first_name=_first_name(full_name),
            verify_url=verify_url,
            ttl_hours=ttl_hours,
        )
        await self._send(EmailMessage(
            to=[email],
            subject=subject,
            html=html,
            text=text,
            from_addr=_sender(),
            reply_to=_reply_to(),
            tags={"category": "verify_email"},
        ))

    async def send_password_reset(self, user: Any, *, token: str,
                                  ttl_minutes: int = 30) -> None:
        _, email, full_name = _extract(user)
        base = _public_site_url()
        reset_url = f"{base}/reset-password/{quote(token, safe='')}"
        subject, html, text = tpl.password_reset_email(
            first_name=_first_name(full_name),
            reset_url=reset_url,
            ttl_minutes=ttl_minutes,
        )
        await self._send(EmailMessage(
            to=[email],
            subject=subject,
            html=html,
            text=text,
            from_addr=_sender(),
            reply_to=_reply_to(),
            tags={"category": "password_reset"},
        ))

    async def send_pickup_code(
        self,
        *,
        email: str,
        name: str,
        code: str,
        shipment_id: str
    ) -> bool:
        subject = "Your SendJet pickup confirmation code"

        text = (
            f"Hello {name or 'there'},\n\n"
            f"Your pickup confirmation code is: {code}\n\n"
            "Give this code to the traveler only after you have physically "
            "handed over the package.\n\n"
            "Do not share this code before the handover.\n\n"
            "SendJet"
        )

        html = f"""
        <h2>Confirm package pickup</h2>
        <p>Hello {escape(name or 'there')},</p>
        <p>Your pickup confirmation code is:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:6px;">
            {code}
        </p>
        <p>
            Give this code to the traveler only after you have physically
            handed over the package.
        </p>
        """

        return await self._send(EmailMessage(
            to=[email],
            subject=subject,
            html=html,
            text=text,
            from_addr=_sender(),
            reply_to=_reply_to(),
            idempotency_key=f"pickup-code:{shipment_id}:{hashlib.sha256(code.encode()).hexdigest()[:12]}",
            tags={"category": "pickup_confirmation"},
        ))

    async def send_delivery_code(
        self,
        *,
        email: str,
        name: str,
        code: str,
        shipment_id: str
    ) -> bool:
        subject = "Your SendJet delivery confirmation code"

        text = (
            f"Hello {name or 'there'},\n\n"
            f"Your delivery confirmation code is: {code}\n\n"
            "Give this code to the traveler only after you have physically "
            "received the package.\n\n"
            "Do not share this code before delivery.\n\n"
            "SendJet"
        )

        html = f"""
        <h2>Confirm package delivery</h2>
        <p>Hello {escape(name or 'there')},</p>
        <p>Your delivery confirmation code is:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:6px;">
            {code}
        </p>
        <p>
            Give this code to the traveler only after you have physically
            received the package.
        </p>
        """

        return await self._send(EmailMessage(
            to=[email],
            subject=subject,
            html=html,
            text=text,
            from_addr=_sender(),
            reply_to=_reply_to(),
            idempotency_key=f"delivery-code:{shipment_id}:{hashlib.sha256(code.encode()).hexdigest()[:12]}",
            tags={"category": "delivery_confirmation"},
        ))


# ---------------------------------------------------------------------------
# FastAPI wiring
# ---------------------------------------------------------------------------
_singleton: Optional[EmailService] = None


def _get_singleton() -> EmailService:
    global _singleton
    if _singleton is None:
        _singleton = EmailService.build_default()
    return _singleton


def get_email_service(request: Request | None = None) -> EmailService:
    """FastAPI dependency — returns the process-wide EmailService instance.

    Attaches it to `request.app.state.email_service` on first use so it can be
    replaced in tests via `app.dependency_overrides` or by mutating state.
    """
    if request is not None:
        cached = getattr(request.app.state, "email_service", None)
        if cached is not None:
            return cached
        svc = _get_singleton()
        request.app.state.email_service = svc
        return svc
    return _get_singleton()
