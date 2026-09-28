"""Exception hierarchy for the AI Hub.

Route handlers should catch `AIHubError` (the base) and translate to HTTP
exceptions at the boundary. Never let these leak to clients raw.
"""


class AIHubError(Exception):
    """Base exception for anything raised inside services.ai.*"""


class AIHubConfigError(AIHubError):
    """Raised when AIHubConfig is invalid or a required env var is missing."""


class AgentNotFoundError(AIHubError):
    """Raised when an agent name is not registered in the AgentRegistry."""


class ToolNotFoundError(AIHubError):
    """Raised when a tool name is not registered in the ToolRegistry."""


class PromptNotFoundError(AIHubError):
    """Raised when a prompt template file cannot be located on disk."""


class MemoryBackendError(AIHubError):
    """Raised by memory store adapters on I/O / serialization failures."""
