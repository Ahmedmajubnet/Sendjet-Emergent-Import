"""Abstract base class and metadata contract for AI agents.

Concrete agents must:
1. Inherit from `BaseAgent`.
2. Implement the async `handle()` method.
3. Register themselves via `@register_agent(AgentSpec(...))`.

Collaborators (prompts loader, memory store, tools registry, logger) are
passed in through the constructor by `AIHubManager`. Agents never import
these globally — this keeps them fully testable with mock collaborators.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Optional

from ..logging_setup import get_logger

if TYPE_CHECKING:  # pragma: no cover — import cycles at type-check time only
    from ..memory.base import BaseMemoryStore
    from ..prompts.loader import PromptLoader
    from ..tools.registry import ToolRegistry


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class AgentSpec:
    """Declarative metadata about an agent.

    Kept separate from the class so registries can list/inspect agents
    without instantiating them (important for `/admin/ai/agents` endpoints
    later, and for CLI tooling).
    """

    name: str                                    # Unique key: 'support', 'marketing', ...
    description: str                             # One-line human summary
    default_prompt: Optional[str] = None         # Path under prompts/templates/
    default_tools: tuple[str, ...] = field(default_factory=tuple)
    tags: tuple[str, ...] = field(default_factory=tuple)


@dataclass
class AgentContext:
    """Per-invocation context passed to `BaseAgent.handle()`.

    Deliberately loose — carries whatever the caller wants the agent to see
    (current user id, locale, conversation id, correlation id, …). Agents
    treat this dict as read-only.
    """

    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    locale: str = "en"
    request_id: Optional[str] = None
    extra: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------
class BaseAgent(ABC):
    """Abstract agent.

    Subclasses receive their collaborators via the constructor. No
    module-level singletons; every dependency is injectable so tests can
    swap in fakes trivially.
    """

    #: Populated by @register_agent. Concrete classes should not set this.
    spec: AgentSpec

    def __init__(
        self,
        *,
        prompts: "PromptLoader",
        memory: "BaseMemoryStore",
        tools: "ToolRegistry",
        # `llm` is intentionally omitted for now. When the LLM adapter lands,
        # we will add `llm: LLMClient` here and wire it via AIHubManager.
    ) -> None:
        if not hasattr(self, "spec"):  # pragma: no cover — misuse guard
            raise RuntimeError(
                f"{type(self).__name__} is missing @register_agent(...) decoration."
            )
        self.prompts = prompts
        self.memory = memory
        self.tools = tools
        self.log = get_logger(type(self).__module__)

    # -- Lifecycle hooks (override if needed) -------------------------------
    async def on_startup(self) -> None:
        """Called once by AIHubManager during boot. Default: no-op."""
        return None

    async def on_shutdown(self) -> None:
        """Called once during graceful shutdown. Default: no-op."""
        return None

    # -- Public contract ----------------------------------------------------
    @abstractmethod
    async def handle(self, message: str, *, context: AgentContext) -> str:
        """Process a single input `message` and return the agent's reply.

        Implementations should:
        - Never raise arbitrary exceptions — wrap I/O failures in
          `services.ai.exceptions.AIHubError`.
        - Log at INFO with `extra={"agent": self.spec.name, "request_id": ...}`.
        - Treat `context` as read-only.
        """
        raise NotImplementedError
