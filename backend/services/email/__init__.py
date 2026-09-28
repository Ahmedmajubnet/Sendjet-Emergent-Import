"""SendJet email subsystem — provider-agnostic transactional mail.

Public surface
--------------
    from services.email import (
        EmailService,           # main entrypoint
        EmailMessage,           # value object passed to providers
        EmailProvider,          # ABC for adding new providers (SendGrid, Postmark, SMTP, ...)
        ResendProvider,         # current implementation
        NullProvider,           # no-op fallback for dev when RESEND_API_KEY is unset
        EmailError,             # domain exception hierarchy root
        get_email_service,      # FastAPI dependency
    )

Design notes
------------
- The public API on `EmailService` is intentionally high-level:
    await mailer.send_welcome(user)
    await mailer.send_verification(user, verify_url)
    await mailer.send_password_reset(user, reset_url)
  Route handlers never touch HTML strings or provider SDKs.
- Switching providers = write a new subclass of `EmailProvider` and update
  `EmailService.build_default()`. Every route handler stays unchanged.
- All sends are non-blocking (`asyncio.to_thread`) because the Resend SDK is sync.
- If `RESEND_API_KEY` is unset (dev / preview without email creds), the service
  degrades to `NullProvider` — it logs the message but never crashes the request.
"""

from .base import EmailMessage, EmailProvider, EmailError, EmailSendError
from .null_provider import NullProvider
from .resend_provider import ResendProvider
from .service import EmailService, get_email_service

__all__ = [
    "EmailService",
    "EmailMessage",
    "EmailProvider",
    "ResendProvider",
    "NullProvider",
    "EmailError",
    "EmailSendError",
    "get_email_service",
]
