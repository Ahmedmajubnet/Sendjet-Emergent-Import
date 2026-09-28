"""AIHubManager — the single entry point into the AI Hub.

Responsibilities
----------------
1. Hold the configuration (`AIHubConfig`).
2. Own the memory-store instance (built from config).
3. Own references to the agent + tool registries.
4. Instantiate agents on demand, wiring their dependencies (DI).
5. Provide lifecycle hooks (`startup`, `shutdown`) for FastAPI to call.
6. Log every meaningful transition.

The manager is deliberately thin. It does NOT contain business logic — that
lives in agents and tools. Adding a new feature means adding a new agent
file, never editing this one.

Lifecycle
---------
    hub = AIHubManager.build_default()  # or build with custom deps
    await hub.startup()                 # discovers agents/tools, boots them
    ...
    await hub.shutdown()

FastAPI wiring
--------------
    from fastapi import FastAPI, Depends
    from services.ai import AIHubManager, get_ai_hub

    app = FastAPI()

    @app.on_event("startup")
    async def _boot_ai():
        app.state.ai_hub = AIHubManager.build_default()
        await app.state.ai_hub.startup()

    @app.on_event("shutdown")
    async def _stop_ai():
        await app.state.ai_hub.shutdown()

    @app.get("/api/ai/agents")
    async def list_agents(hub: AIHubManager = Depends(get_ai_hub)):
        return [dataclasses.asdict(s) for s in hub.list_agents()]
"""

from __future__ import annotations

import dataclasses
import logging
from typing import TYPE_CHECKING, Optional

from fastapi import Request

from .agents.base import AgentSpec, BaseAgent
from .agents.registry import AgentRegistry, agent_registry as _default_agent_registry
from .config import AIHubConfig
from .exceptions import AgentNotFoundError, AIHubError
from .logging_setup import get_logger
from .memory.base import BaseMemoryStore
from .memory.in_memory import InMemoryStore, NullMemoryStore
from .prompts.loader import PromptLoader
from .tools.base import ToolSpec
from .tools.registry import ToolRegistry, tool_registry as _default_tool_registry

if TYPE_CHECKING:  # pragma: no cover
    from fastapi import FastAPI

_log = get_logger(__name__)


class AIHubManager:
    """Central orchestrator for the AI Hub.

    Prefer `AIHubManager.build_default()` for standard usage. The full
    constructor is exposed so tests can inject fakes for every collaborator.
    """

    def __init__(
        self,
        *,
        config: AIHubConfig,
        prompts: PromptLoader,
        memory: BaseMemoryStore,
        agents: AgentRegistry,
        tools: ToolRegistry,
    ) -> None:
        self.config = config
        self.prompts = prompts
        self.memory = memory
        self.agents = agents
        self.tools = tools

        # Per-agent-name instance cache — populated on first `get_agent()`.
        self._agent_instances: dict[str, BaseAgent] = {}
        self._started = False

    # ==================================================================
    # Factories
    # ==================================================================
    @classmethod
    def build_default(cls, config: Optional[AIHubConfig] = None) -> "AIHubManager":
        """Standard construction path: reads env, picks defaults, wires
        singletons. No I/O happens here — that is `startup()`'s job."""
        cfg = config or AIHubConfig.from_env()
        memory = _select_memory_backend(cfg)
        prompts = PromptLoader(cfg.prompts_dir)
        return cls(
            config=cfg,
            prompts=prompts,
            memory=memory,
            agents=_default_agent_registry,
            tools=_default_tool_registry,
        )

    # ==================================================================
    # Lifecycle
    # ==================================================================
    async def startup(self) -> None:
        """Discover agents/tools and let each agent run its `on_startup`.

        Idempotent. When `config.enabled == False`, this is a no-op except
        for a log line — useful in preview envs where we want the code
        loaded but no agents actually running.
        """
        if self._started:
            _log.debug("ai_hub_already_started")
            return

        # Set log level on the whole `sendjet.ai` namespace exactly once.
        logging.getLogger("sendjet.ai").setLevel(self.config.log_level)

        if not self.config.enabled:
            _log.info(
                "ai_hub_dormant",
                extra={"reason": "AI_HUB_ENABLED is false"},
            )
            self._started = True
            return

        new_agents = self.agents.discover()
        new_tools = self.tools.discover()
        _log.info(
            "ai_hub_discovery_complete",
            extra={
                "agents_registered": len(self.agents),
                "tools_registered": len(self.tools),
                "new_agents": new_agents,
                "new_tools": new_tools,
            },
        )

        # Instantiate + boot each agent so bugs surface at startup, not on
        # first request. Failed agents are logged but do not block the rest.
        for spec, cls in self.agents:
            try:
                inst = self._instantiate_agent(cls)
                await inst.on_startup()
                self._agent_instances[spec.name] = inst
                _log.info("agent_boot_ok", extra={"agent": spec.name})
            except Exception as exc:  # noqa: BLE001 — we want a single fence
                _log.exception(
                    "agent_boot_failed",
                    extra={"agent": spec.name, "error": repr(exc)},
                )

        self._started = True

    async def shutdown(self) -> None:
        """Call `on_shutdown` on every booted agent. Safe to call more than once."""
        for name, inst in list(self._agent_instances.items()):
            try:
                await inst.on_shutdown()
            except Exception as exc:  # noqa: BLE001
                _log.exception(
                    "agent_shutdown_failed",
                    extra={"agent": name, "error": repr(exc)},
                )
        self._agent_instances.clear()
        self._started = False
        _log.info("ai_hub_shutdown_complete")

    # ==================================================================
    # Public accessors
    # ==================================================================
    def get_agent(self, name: str) -> BaseAgent:
        """Return the (memoized) instance of a registered agent.

        Raises `AgentNotFoundError` if the name is unknown, `AIHubError`
        if the hub has not been started yet.
        """
        if not self._started:
            raise AIHubError("AIHubManager.startup() must be awaited before use.")
        if name in self._agent_instances:
            return self._agent_instances[name]
        # Late registration (e.g. agents added via plugin import after
        # startup) — instantiate on demand.
        _spec, cls = self.agents.get(name)
        inst = self._instantiate_agent(cls)
        self._agent_instances[name] = inst
        return inst

    def list_agents(self) -> list[AgentSpec]:
        return self.agents.specs()

    def list_tools(self) -> list[ToolSpec]:
        return self.tools.specs()

    def describe(self) -> dict:
        """Snapshot suitable for `/api/ai/health` endpoints later."""
        return {
            "enabled": self.config.enabled,
            "started": self._started,
            "memory_backend": self.config.memory_backend,
            "agents": [dataclasses.asdict(s) for s in self.list_agents()],
            "tools": [dataclasses.asdict(s) for s in self.list_tools()],
            "prompts_available": self.prompts.list_available(),
        }

    # ==================================================================
    # Internals
    # ==================================================================
    def _instantiate_agent(self, cls: type[BaseAgent]) -> BaseAgent:
        return cls(
            prompts=self.prompts,
            memory=self.memory,
            tools=self.tools,
        )


# ---------------------------------------------------------------------------
# Memory backend selector
# ---------------------------------------------------------------------------
def _select_memory_backend(cfg: AIHubConfig) -> BaseMemoryStore:
    if cfg.memory_backend == "null":
        return NullMemoryStore()
    if cfg.memory_backend == "in_memory":
        return InMemoryStore()
    # Config validator already restricts to the allowed set, but be defensive.
    raise AIHubError(f"Unhandled memory_backend: '{cfg.memory_backend}'")


# ---------------------------------------------------------------------------
# FastAPI dependency provider
# ---------------------------------------------------------------------------
def get_ai_hub(request: Request) -> AIHubManager:
    """FastAPI dependency: returns the app-scoped AIHubManager.

    Assumes the app registered the hub on `app.state.ai_hub` during startup
    (see the module docstring for the recommended wiring). Raises a clear
    `AIHubError` if that step was skipped, rather than an obscure attribute
    error on the first request.
    """
    hub: Optional[AIHubManager] = getattr(request.app.state, "ai_hub", None)
    if hub is None:
        raise AIHubError(
            "AIHubManager not attached to app.state.ai_hub. "
            "Register it in your FastAPI startup event."
        )
    return hub
