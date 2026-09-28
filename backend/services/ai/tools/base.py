"""Abstract base class and metadata for tools that agents can call.

A "tool" is a strongly-typed unit of capability: `run(**kwargs) -> Any`.
When an LLM function-calling loop is introduced, the LLM adapter will
translate `ToolSpec.input_schema` into the model-native tool-calling schema
(OpenAI function schema, Anthropic tool_use, Gemini function declarations,
…). Tools themselves stay adapter-agnostic.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from ..logging_setup import get_logger


@dataclass(frozen=True)
class ToolSpec:
    """Declarative metadata about a tool."""

    name: str                                    # Unique key: 'faq_search', 'db_read', ...
    description: str                             # One-line human summary; also sent to LLM.
    #: JSON-schema-style parameter map. Kept as a plain dict so we do not
    #: couple to a specific validation library. Example:
    #:     {"query": "str", "limit": "int?"}
    input_schema: dict[str, Any] = field(default_factory=dict)
    tags: tuple[str, ...] = field(default_factory=tuple)


class BaseTool(ABC):
    """Abstract tool."""

    #: Populated by @register_tool. Concrete classes should not set this.
    spec: ToolSpec

    def __init__(self) -> None:
        if not hasattr(self, "spec"):  # pragma: no cover — misuse guard
            raise RuntimeError(
                f"{type(self).__name__} is missing @register_tool(...) decoration."
            )
        self.log = get_logger(type(self).__module__)

    @abstractmethod
    async def run(self, **kwargs: Any) -> Any:
        """Execute the tool. `kwargs` must match `spec.input_schema`.

        Return whatever the caller (agent) needs — typically JSON-serializable
        data so the LLM adapter can feed it back into the model.
        """
        raise NotImplementedError
