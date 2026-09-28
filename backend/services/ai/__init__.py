"""SendJet AI Hub — modular, extensible, LLM-agnostic.

Public surface (import from this package, never from sub-modules directly
except when writing new agents/tools):

    from services.ai import (
        AIHubManager,          # Central orchestrator
        AIHubConfig,           # Typed configuration object
        BaseAgent, AgentSpec,  # For defining new agents
        BaseTool, ToolSpec,    # For defining new tools
        BaseMemoryStore,       # For pluggable memory backends
        register_agent,        # Decorator: registers agent in the registry
        register_tool,         # Decorator: registers tool in the registry
        get_ai_hub,            # FastAPI dependency provider
        AIHubError,            # Base exception for AI subsystem
    )

Architecture doc: `services/ai/README.md`.
"""

from .ai_manager import AIHubManager, get_ai_hub
from .config import AIHubConfig
from .agents.base import BaseAgent, AgentSpec
from .agents.registry import register_agent, agent_registry
from .tools.base import BaseTool, ToolSpec
from .tools.registry import register_tool, tool_registry
from .memory.base import BaseMemoryStore
from .exceptions import (
    AIHubError,
    AgentNotFoundError,
    ToolNotFoundError,
    PromptNotFoundError,
    AIHubConfigError,
)

__all__ = [
    "AIHubManager",
    "AIHubConfig",
    "BaseAgent",
    "AgentSpec",
    "BaseTool",
    "ToolSpec",
    "BaseMemoryStore",
    "register_agent",
    "agent_registry",
    "register_tool",
    "tool_registry",
    "get_ai_hub",
    "AIHubError",
    "AgentNotFoundError",
    "ToolNotFoundError",
    "PromptNotFoundError",
    "AIHubConfigError",
]
