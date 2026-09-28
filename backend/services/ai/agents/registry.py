"""Agent registry with decorator-based registration.

Design
------
- A single module-level `AgentRegistry` instance (`agent_registry`) holds the
  mapping of `name -> (AgentSpec, class)`. It does NOT instantiate agents —
  that is `AIHubManager`'s job (so DI collaborators can be supplied).
- Users register new agents by decorating their class with
  `@register_agent(AgentSpec(...))`. Importing the module is enough; a
  central `discover()` helper walks the `agents/` directory on startup.

Why a registry (and not just `importlib`)?
    Because we want *metadata* (`AgentSpec`) available without instantiation,
    e.g. for admin dashboards listing available agents.
"""

from __future__ import annotations

import importlib
import pkgutil
from pathlib import Path
from typing import Callable, Iterator, Type

from ..exceptions import AgentNotFoundError, AIHubError
from ..logging_setup import get_logger
from .base import AgentSpec, BaseAgent

_log = get_logger(__name__)


class AgentRegistry:
    """In-memory registry of agent classes keyed by their `AgentSpec.name`."""

    def __init__(self) -> None:
        self._entries: dict[str, tuple[AgentSpec, Type[BaseAgent]]] = {}

    # -- Mutations ---------------------------------------------------------
    def add(self, spec: AgentSpec, cls: Type[BaseAgent]) -> None:
        if spec.name in self._entries:
            existing = self._entries[spec.name][1]
            raise AIHubError(
                f"Agent name collision: '{spec.name}' already registered "
                f"by {existing.__module__}.{existing.__name__}"
            )
        # Attach spec to the class so instances can introspect it.
        cls.spec = spec  # type: ignore[attr-defined]
        self._entries[spec.name] = (spec, cls)
        _log.debug("agent_registered", extra={"agent": spec.name})

    # -- Queries -----------------------------------------------------------
    def get(self, name: str) -> tuple[AgentSpec, Type[BaseAgent]]:
        if name not in self._entries:
            raise AgentNotFoundError(f"No agent named '{name}' is registered.")
        return self._entries[name]

    def specs(self) -> list[AgentSpec]:
        return [spec for spec, _ in self._entries.values()]

    def __iter__(self) -> Iterator[tuple[AgentSpec, Type[BaseAgent]]]:
        return iter(self._entries.values())

    def __len__(self) -> int:
        return len(self._entries)

    def __contains__(self, name: object) -> bool:
        return isinstance(name, str) and name in self._entries

    # -- Discovery ---------------------------------------------------------
    def discover(self, package: str = "services.ai.agents") -> int:
        """Import every module under `package` so their decorators fire.

        Returns the number of newly-registered agents. Safe to call multiple
        times.
        """
        before = len(self._entries)
        pkg = importlib.import_module(package)
        pkg_path = Path(pkg.__file__).parent  # type: ignore[arg-type]
        for mod in pkgutil.iter_modules([str(pkg_path)]):
            if mod.name in {"base", "registry", "__init__"}:
                continue
            importlib.import_module(f"{package}.{mod.name}")
        return len(self._entries) - before


# Module-level singleton. Access via services.ai.agent_registry.
agent_registry = AgentRegistry()


def register_agent(spec: AgentSpec) -> Callable[[Type[BaseAgent]], Type[BaseAgent]]:
    """Class decorator that registers the agent in `agent_registry`.

    Example
    -------
        @register_agent(AgentSpec(name="support", description="..."))
        class SupportAgent(BaseAgent):
            async def handle(self, message, *, context):
                ...
    """

    def _wrap(cls: Type[BaseAgent]) -> Type[BaseAgent]:
        if not issubclass(cls, BaseAgent):
            raise AIHubError(
                f"@register_agent applied to {cls.__name__} which does not "
                "inherit from BaseAgent."
            )
        agent_registry.add(spec, cls)
        return cls

    return _wrap
