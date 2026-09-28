"""Agents sub-package.

Each concrete agent lives in its own module inside this package. Register
via `@register_agent(AgentSpec(...))` — the AgentRegistry then makes it
discoverable to the AIHubManager without any change to central code.
"""

from .base import BaseAgent, AgentSpec, AgentContext
from .registry import AgentRegistry, register_agent, agent_registry

__all__ = [
    "BaseAgent",
    "AgentSpec",
    "AgentContext",
    "AgentRegistry",
    "register_agent",
    "agent_registry",
]
