"""Tool registry — same shape as AgentRegistry, kept separate to avoid
namespace collisions between agent names and tool names."""

from __future__ import annotations

import importlib
import pkgutil
from pathlib import Path
from typing import Callable, Iterator, Type

from ..exceptions import AIHubError, ToolNotFoundError
from ..logging_setup import get_logger
from .base import BaseTool, ToolSpec

_log = get_logger(__name__)


class ToolRegistry:
    """In-memory registry of tool classes keyed by `ToolSpec.name`.

    Unlike agents, tools are instantiated lazily on first lookup so we can
    cheaply have hundreds registered without paying construction cost until
    they are actually used.
    """

    def __init__(self) -> None:
        self._entries: dict[str, tuple[ToolSpec, Type[BaseTool]]] = {}
        self._instances: dict[str, BaseTool] = {}

    # -- Mutations ---------------------------------------------------------
    def add(self, spec: ToolSpec, cls: Type[BaseTool]) -> None:
        if spec.name in self._entries:
            existing = self._entries[spec.name][1]
            raise AIHubError(
                f"Tool name collision: '{spec.name}' already registered "
                f"by {existing.__module__}.{existing.__name__}"
            )
        cls.spec = spec  # type: ignore[attr-defined]
        self._entries[spec.name] = (spec, cls)
        _log.debug("tool_registered", extra={"tool": spec.name})

    # -- Queries -----------------------------------------------------------
    def get(self, name: str) -> BaseTool:
        """Return a memoized instance of the tool."""
        if name not in self._entries:
            raise ToolNotFoundError(f"No tool named '{name}' is registered.")
        if name not in self._instances:
            _spec, cls = self._entries[name]
            self._instances[name] = cls()
        return self._instances[name]

    def specs(self) -> list[ToolSpec]:
        return [spec for spec, _ in self._entries.values()]

    def __iter__(self) -> Iterator[tuple[ToolSpec, Type[BaseTool]]]:
        return iter(self._entries.values())

    def __len__(self) -> int:
        return len(self._entries)

    def __contains__(self, name: object) -> bool:
        return isinstance(name, str) and name in self._entries

    # -- Discovery ---------------------------------------------------------
    def discover(self, package: str = "services.ai.tools") -> int:
        before = len(self._entries)
        pkg = importlib.import_module(package)
        pkg_path = Path(pkg.__file__).parent  # type: ignore[arg-type]
        for mod in pkgutil.iter_modules([str(pkg_path)]):
            if mod.name in {"base", "registry", "__init__"}:
                continue
            importlib.import_module(f"{package}.{mod.name}")
        return len(self._entries) - before


tool_registry = ToolRegistry()


def register_tool(spec: ToolSpec) -> Callable[[Type[BaseTool]], Type[BaseTool]]:
    """Class decorator that registers the tool in `tool_registry`."""

    def _wrap(cls: Type[BaseTool]) -> Type[BaseTool]:
        if not issubclass(cls, BaseTool):
            raise AIHubError(
                f"@register_tool applied to {cls.__name__} which does not "
                "inherit from BaseTool."
            )
        tool_registry.add(spec, cls)
        return cls

    return _wrap
