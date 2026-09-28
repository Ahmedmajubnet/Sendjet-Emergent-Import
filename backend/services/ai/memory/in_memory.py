"""Reference memory implementations.

- `InMemoryStore` : keeps records in a process-local dict. Perfect for
                    tests and local dev. Contents die with the process.
- `NullMemoryStore`: always empty; useful for stateless agents or when a
                     caller wants to disable memory without changing code.

Production-grade backends (MongoDB, Redis, vector DBs) will be added later
under `services/ai/memory/` — one file per backend.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Optional

from ..logging_setup import get_logger
from .base import BaseMemoryStore, MemoryRecord

_log = get_logger(__name__)


class NullMemoryStore(BaseMemoryStore):
    """No-op memory. All writes are dropped; reads always return []."""

    async def append(self, session_id: str, record: MemoryRecord) -> None:  # noqa: D401
        return None

    async def history(
        self,
        session_id: str,
        limit: Optional[int] = None,
    ) -> list[MemoryRecord]:
        return []

    async def clear(self, session_id: str) -> None:
        return None


class InMemoryStore(BaseMemoryStore):
    """Process-local, asyncio-safe memory store.

    Not durable — contents vanish on restart. Do NOT use in production for
    anything that must survive a redeploy.
    """

    def __init__(self) -> None:
        self._data: dict[str, list[MemoryRecord]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def append(self, session_id: str, record: MemoryRecord) -> None:
        async with self._lock:
            self._data[session_id].append(record)

    async def history(
        self,
        session_id: str,
        limit: Optional[int] = None,
    ) -> list[MemoryRecord]:
        async with self._lock:
            records = list(self._data.get(session_id, ()))
        if limit is not None and limit >= 0:
            return records[-limit:]
        return records

    async def clear(self, session_id: str) -> None:
        async with self._lock:
            self._data.pop(session_id, None)
