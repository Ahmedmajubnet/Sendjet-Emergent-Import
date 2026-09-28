"""Configuration for the AI Hub.

All settings read from environment variables (with `AI_HUB_` prefix) so
production overrides are trivial and no secrets live in code.

Nothing here connects to an LLM — those fields simply describe *what would
be used* once the LLM adapter lands. `enabled` defaults to False so the hub
is dormant until we explicitly turn it on.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from .exceptions import AIHubConfigError

# Root directory containing prompt templates on disk. Resolved once at import
# so tests can monkeypatch if needed.
_DEFAULT_PROMPTS_DIR = Path(__file__).parent / "prompts" / "templates"


class AIHubConfig(BaseModel):
    """Typed, env-driven configuration for the AI Hub.

    Fields intentionally cover ONLY the shape of a future LLM integration —
    no code in this package reads `default_model` / `emergent_llm_key_env`
    yet. They exist so the shape is stable when we wire the LLM layer.
    """

    # ---- Feature flag --------------------------------------------------
    enabled: bool = Field(
        default=False,
        description="Master switch. When False, AIHubManager.load_agents() is a no-op.",
    )

    # ---- Prompts -------------------------------------------------------
    prompts_dir: Path = Field(
        default=_DEFAULT_PROMPTS_DIR,
        description="Filesystem root where prompt templates are loaded from.",
    )

    # ---- Memory backend selector --------------------------------------
    memory_backend: str = Field(
        default="in_memory",
        description="Which BaseMemoryStore implementation to instantiate. "
                    "One of: 'in_memory', 'null'. Additional backends "
                    "(e.g. 'mongo') can be added later.",
    )

    # ---- LLM placeholders (NOT USED YET, kept for forward compatibility)
    default_model: str = Field(
        default="unset",
        description="Reserved. Model identifier that agents will default to "
                    "once the LLM adapter is wired.",
    )
    emergent_llm_key_env: str = Field(
        default="EMERGENT_LLM_KEY",
        description="Name of the env var that will hold the Emergent Universal "
                    "LLM key when the LLM adapter is added. Not read today.",
    )

    # ---- Observability -------------------------------------------------
    log_level: str = Field(
        default="INFO",
        description="Log level applied to the `sendjet.ai` namespace at startup.",
    )

    @field_validator("memory_backend")
    @classmethod
    def _known_backend(cls, v: str) -> str:
        allowed = {"in_memory", "null"}
        if v not in allowed:
            raise AIHubConfigError(
                f"Unknown memory_backend '{v}'. Expected one of: {sorted(allowed)}."
            )
        return v

    @field_validator("log_level")
    @classmethod
    def _known_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        v_up = v.upper()
        if v_up not in allowed:
            raise AIHubConfigError(
                f"Unknown log_level '{v}'. Expected one of: {sorted(allowed)}."
            )
        return v_up

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------
    @classmethod
    def from_env(cls, env: Optional[dict] = None) -> "AIHubConfig":
        """Build an AIHubConfig by reading `AI_HUB_*` environment variables.

        `env` argument is only used by tests; production callers should
        omit it and rely on `os.environ`.
        """
        e = env if env is not None else os.environ
        return cls(
            enabled=e.get("AI_HUB_ENABLED", "false").lower() in {"1", "true", "yes"},
            prompts_dir=Path(e.get("AI_HUB_PROMPTS_DIR", str(_DEFAULT_PROMPTS_DIR))),
            memory_backend=e.get("AI_HUB_MEMORY_BACKEND", "in_memory"),
            default_model=e.get("AI_HUB_DEFAULT_MODEL", "unset"),
            emergent_llm_key_env=e.get("AI_HUB_EMERGENT_KEY_ENV", "EMERGENT_LLM_KEY"),
            log_level=e.get("AI_HUB_LOG_LEVEL", "INFO"),
        )
