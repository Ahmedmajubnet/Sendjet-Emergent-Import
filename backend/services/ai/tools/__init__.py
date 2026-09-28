"""Tools sub-package.

Tools are callable capabilities that agents can invoke (RAG search, DB
lookups, Stripe queries, image generators, …). They MUST be pure with
respect to their inputs — no hidden globals — so they can be composed and
tested in isolation.
"""

from .base import BaseTool, ToolSpec
from .registry import ToolRegistry, register_tool, tool_registry

__all__ = [
    "BaseTool",
    "ToolSpec",
    "ToolRegistry",
    "register_tool",
    "tool_registry",
]
