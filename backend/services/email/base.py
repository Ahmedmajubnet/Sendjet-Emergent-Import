"""Base contracts for the email subsystem.

Contains:
- `EmailMessage`  — provider-agnostic message value object
- `EmailProvider` — abstract base class every provider must implement
- Exception hierarchy
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------
class EmailError(Exception):
    """Base exception for anything raised by services.email.*"""


class EmailSendError(EmailError):
    """Raised when a provider fails to hand the message off."""


# ---------------------------------------------------------------------------
# Value object
# ---------------------------------------------------------------------------
@dataclass
class EmailMessage:
    """A single transactional email, ready to hand to any provider.

    Deliberately provider-agnostic — no Resend / SendGrid fields.
    """
    to: list[str]                                # recipient addresses
    subject: str
    html: str                                    # rendered HTML body
    text: Optional[str] = None                   # plain-text alternate (recommended)
    from_addr: Optional[str] = None              # provider default when None
    reply_to: Optional[str] = None
    #: Idempotency key — providers that support it should de-duplicate.
    #: Format: '<purpose>:<stable-id>', e.g. 'welcome:user-uuid-here'.
    idempotency_key: Optional[str] = None
    tags: dict[str, str] = field(default_factory=dict)  # analytics / segmentation

    def to_dict(self) -> dict:
        """Serialize for logging without leaking secret headers."""
        return {
            "to": self.to,
            "subject": self.subject,
            "from": self.from_addr,
            "reply_to": self.reply_to,
            "has_text_alt": bool(self.text),
            "html_bytes": len(self.html),
            "tags": self.tags,
        }


# ---------------------------------------------------------------------------
# Provider interface
# ---------------------------------------------------------------------------
class EmailProvider(ABC):
    """Contract every mail-service adapter must satisfy.

    Concrete implementations live in sibling modules:
      - `resend_provider.py` — production
      - `null_provider.py`   — dev fallback / testing double
    """

    #: Machine-readable identifier surfaced in logs and health checks.
    name: str = "abstract"

    @abstractmethod
    async def send(self, message: EmailMessage) -> str:
        """Send the message; return provider message id on success.

        Must NOT block the event loop (wrap sync SDK calls in
        `asyncio.to_thread`). Must raise `EmailSendError` on failure.
        """
        raise NotImplementedError

    async def close(self) -> None:
        """Release any resources. Default: no-op."""
        return None
