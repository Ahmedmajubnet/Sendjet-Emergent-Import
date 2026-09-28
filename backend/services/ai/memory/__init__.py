"""Memory sub-package.

Memory stores hold conversational context, long-term facts, and any other
data an agent wants to persist across turns. The `BaseMemoryStore`
interface is deliberately narrow so multiple backends (in-memory, Mongo,
Redis, vector DB) can be swapped by config.
"""

from .base import BaseMemoryStore, MemoryRecord
from .in_memory import InMemoryStore, NullMemoryStore

__all__ = [
    "BaseMemoryStore",
    "MemoryRecord",
    "InMemoryStore",
    "NullMemoryStore",
]
