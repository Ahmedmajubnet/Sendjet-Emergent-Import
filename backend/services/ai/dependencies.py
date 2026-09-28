"""FastAPI dependency wiring for the AI Hub.

This module is intentionally tiny — most of the wiring lives on
`AIHubManager` itself. Keeping the FastAPI-specific glue isolated here
means the rest of the package stays framework-agnostic and can be reused
in a CLI, a worker, or a test-only harness.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .ai_manager import AIHubManager, get_ai_hub

if TYPE_CHECKING:  # pragma: no cover
    from fastapi import FastAPI


def attach_ai_hub(app: "FastAPI", hub: AIHubManager | None = None) -> AIHubManager:
    """Wire the AI Hub into a FastAPI application.

    Called from `server.py`:

        from services.ai.dependencies import attach_ai_hub
        attach_ai_hub(app)

    That single line:
      - Instantiates `AIHubManager.build_default()` (unless `hub` is passed)
      - Registers `startup` / `shutdown` handlers
      - Exposes the hub on `app.state.ai_hub` for `get_ai_hub` to find
    """
    hub = hub or AIHubManager.build_default()
    app.state.ai_hub = hub

    @app.on_event("startup")
    async def _startup_ai_hub() -> None:  # pragma: no cover — trivial glue
        await hub.startup()

    @app.on_event("shutdown")
    async def _shutdown_ai_hub() -> None:  # pragma: no cover — trivial glue
        await hub.shutdown()

    return hub


__all__ = ["attach_ai_hub", "get_ai_hub"]
