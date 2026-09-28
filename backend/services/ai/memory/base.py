"""Abstract memory-store interface.

An agent asks its memory store to:

    - `append(session_id, record)` : add a turn / event
    - `history(session_id, limit)` : fetch recent turns (ordered oldest → newest)
    - `clear(session_id)`          : wipe a session (used on `/reset` commands)

Everything is keyed by `session_id`, which the caller chooses. Typical
choices: `f"support:{user_id}"`, `f"marketing:global"`, a conversation id.

Concrete implementations MUST be thread-safe for reads and writes because
FastAPI can serve concurrent requests from a shared instance.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional


@dataclass
class MemoryRecord:
    """One unit of memory. Loose by design — different agents store different
    shapes and the store must not care.

    Common shapes we anticipate:
        role='user',      content='...'         # chat turn
        role='assistant', content='...'         # chat turn
        role='system',    content='...'         # tool result / system note
        role='fact',      content='...',        # long-term memory fact
                          metadata={'topic': 'shipping_rates'}
    """

    role: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class BaseMemoryStore(ABC):
    """Contract every memory backend must satisfy."""

    @abstractmethod
    async def append(self, session_id: str, record: MemoryRecord) -> None: ...

    @abstractmethod
    async def history(
        self,
        session_id: str,
        limit: Optional[int] = None,
    ) -> list[MemoryRecord]:
        """Return records for the session, oldest first. `limit` clips to the
        MOST RECENT `limit` records but the returned list is still oldest→newest.
        """

    @abstractmethod
    async def clear(self, session_id: str) -> None: ...
