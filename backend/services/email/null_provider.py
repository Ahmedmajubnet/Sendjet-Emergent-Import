"""No-op email provider.

Used when RESEND_API_KEY is unset (dev / preview) so route handlers can call
`await mailer.send_welcome(user)` without exploding. Every send is logged so
you can still eyeball the content in the backend log.
"""

from __future__ import annotations

import uuid

from .base import EmailMessage, EmailProvider
from ..ai.logging_setup import get_logger  # reuse namespaced logger factory


_log = get_logger(__name__)


class NullProvider(EmailProvider):
    """Records the send in logs but never actually delivers."""

    name = "null"

    async def send(self, message: EmailMessage) -> str:
        _log.warning(
            "email_would_be_sent (NullProvider — set RESEND_API_KEY to enable delivery)",
            extra={"email": message.to_dict()},
        )
        return f"null:{uuid.uuid4()}"
