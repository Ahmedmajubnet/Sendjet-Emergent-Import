"""Resend email provider.

Wraps the sync `resend` Python SDK in a non-blocking async interface. All
network I/O happens via `asyncio.to_thread` so FastAPI's event loop stays free.

Retries: 3 attempts with exponential backoff on 5xx / network errors. 4xx
(bad payload, invalid recipient) raises immediately — retries wouldn't help.
"""

from __future__ import annotations

import asyncio
from typing import Any

import resend

from .base import EmailMessage, EmailProvider, EmailSendError
from ..ai.logging_setup import get_logger


_log = get_logger(__name__)


class ResendProvider(EmailProvider):
    """Production adapter over the Resend API."""

    name = "resend"

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ValueError("ResendProvider requires a non-empty api_key.")
        # The `resend` SDK reads its API key from a module attribute.
        resend.api_key = api_key
        self._max_attempts = 3
        self._base_backoff_s = 0.5

    async def send(self, message: EmailMessage) -> str:
        payload: dict[str, Any] = {
            "from": message.from_addr,
            "to": message.to,
            "subject": message.subject,
            "html": message.html,
        }
        if message.text:
            payload["text"] = message.text
        if message.reply_to:
            payload["reply_to"] = message.reply_to
        if message.tags:
            # Resend expects tags as [{"name": k, "value": v}, ...]
            payload["tags"] = [
                {"name": k, "value": v} for k, v in message.tags.items()
            ]
        if message.idempotency_key:
            # Resend does not offer a first-class idempotency key today; we send
            # it as a header so it's visible on the request-log side and easy
            # to swap to a real dedupe key when they ship one.
            payload["headers"] = {"X-Idempotency-Key": message.idempotency_key}

        last_exc: Exception | None = None
        for attempt in range(1, self._max_attempts + 1):
            try:
                result = await asyncio.to_thread(resend.Emails.send, payload)
                message_id = result.get("id") if isinstance(result, dict) else None
                if not isinstance(message_id, str) or not message_id:
                    raise EmailSendError("Email provider did not return a message id")
                _log.info(
                    "email_sent",
                    extra={
                        "provider": self.name,
                        "message_id": message_id,
                        "attempt": attempt,
                        **message.to_dict(),
                    },
                )
                return message_id or ""
            except Exception as exc:  # noqa: BLE001 — SDK raises broad types
                last_exc = exc
                # Best-effort transient-error detection.
                # Resend raises `resend.exceptions.ResendError`; only 5xx and
                # network errors (no status_code) are worth retrying.
                # 4xx errors (bad domain, invalid recipient, quota) are permanent.
                status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
                error_msg = str(exc).lower()
                permanent_signals = (
                    "domain is not verified",
                    "invalid email",
                    "invalid `from` field",
                    "invalid api key",
                    "rate limit",  # 429 — we still don't want a tight retry loop
                )
                is_permanent_msg = any(sig in error_msg for sig in permanent_signals)
                retriable = (
                    not is_permanent_msg
                    and (status is None or (isinstance(status, int) and status >= 500))
                )
                _log.warning(
                    "email_send_attempt_failed",
                    extra={
                        "provider": self.name,
                        "attempt": attempt,
                        "status": status,
                        "retriable": retriable,
                        "error_type": type(exc).__name__,
                    },
                )
                if not retriable or attempt == self._max_attempts:
                    break
                await asyncio.sleep(self._base_backoff_s * (2 ** (attempt - 1)))

        raise EmailSendError(
            "Resend did not accept the email"
        ) from last_exc
